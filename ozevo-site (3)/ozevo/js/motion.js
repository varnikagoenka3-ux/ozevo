/* OZÉVO — shared motion layer
   Scroll progress, header behaviour, parallax, pointer tilt, count-ups, link prefetch.
   Everything is transform/opacity driven and switches off for reduced motion / low-power devices. */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var conn = navigator.connection || {};
  var lite = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
             (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
             conn.saveData === true;
  if (reduced) root.classList.add('reduce-motion');
  if (lite) root.classList.add('lite');
  var motion = !reduced && !lite;

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- Scroll progress hairline ---------- */
  var bar = doc.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(bar);

  /* ---------- Parallax / scrub layers (only the ones near the viewport are updated) ---------- */
  var layers = Array.prototype.slice.call(doc.querySelectorAll('[data-parallax],[data-scrub]'));
  var live = new Set();
  if (motion && layers.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? live.add(e.target) : live.delete(e.target); });
      schedule();
    }, { rootMargin: '25% 0px' });
    layers.forEach(function (l) { io.observe(l); });
  }
  function updateLayers() {
    var vh = window.innerHeight;
    live.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var applied = el._py || 0;
      var top = r.top - applied;                  // layout position without our own offset
      if (el.hasAttribute('data-parallax')) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.08;
        var offset = (top + r.height / 2) - vh / 2;
        var py = clamp(-offset * speed, -140, 140);
        el._py = py;
        el.style.setProperty('--py', py.toFixed(1) + 'px');
      }
      if (el.hasAttribute('data-scrub')) {
        var sp = clamp((vh - top) / (vh + r.height), 0, 1);
        el.style.setProperty('--sp', sp.toFixed(4));
      }
    });
  }

  /* ---------- Scroll frame: progress bar, header, layers ---------- */
  var header = doc.querySelector('.site-header');
  var mobileNav = doc.querySelector('.mobile-nav');
  var lastY = window.scrollY, acc = 0, ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var max = root.scrollHeight - window.innerHeight;
    bar.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : '0');

    if (header && !reduced) {
      var menuOpen = mobileNav && mobileNav.classList.contains('open');
      var dy = y - lastY;
      if (dy * acc < 0) acc = 0;                  // direction changed
      acc += dy;
      if (menuOpen || y <= 120 || acc < -24) header.classList.remove('is-hidden');
      else if (acc > 48) header.classList.add('is-hidden');
    }
    lastY = y;
    if (motion) updateLayers();
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  frame();

  /* ---------- Pointer tilt for product imagery ---------- */
  if (motion && finePointer) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-tilt]'), function (el) {
      var zone = el.closest('[data-tilt-zone]') || el.parentElement;
      if (!zone) return;
      var max = parseFloat(el.getAttribute('data-tilt')) || 7;
      var nx = 0, ny = 0, raf = 0;
      function apply() {
        raf = 0;
        el.style.setProperty('--ry', (nx * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-ny * max * 0.75).toFixed(2) + 'deg');
      }
      zone.addEventListener('pointermove', function (e) {
        var r = zone.getBoundingClientRect();
        nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        el.classList.add('is-tilting');
        if (!raf) raf = requestAnimationFrame(apply);
      });
      zone.addEventListener('pointerleave', function () {
        nx = 0; ny = 0;
        el.classList.remove('is-tilting');
        if (!raf) raf = requestAnimationFrame(apply);
      });
    });
  }

  /* ---------- Count-up numerals ---------- */
  function countUp(el) {
    if (el._counted) return;
    el._counted = true;
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    if (!motion) { el.textContent = String(target); return; }
    var dur = 1500, t0 = performance.now();
    (function tick(now) {
      var t = clamp((now - t0) / dur, 0, 1);
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);       // ease-out expo
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }
  var counters = Array.prototype.slice.call(doc.querySelectorAll('[data-count]:not([data-count-manual])'));
  if (counters.length) {
    if (motion && 'IntersectionObserver' in window) {
      counters.forEach(function (c) { c.textContent = '0'; });
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
      }, { threshold: 0.6 });
      counters.forEach(function (c) { cio.observe(c); });
    }
  }
  window.OZ = { countUp: countUp, reduced: reduced, lite: lite, motion: motion };

  /* ---------- Clean up reveal stagger delay so hover feels instant afterwards ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('.reveal'), function (el) {
    el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
  });

  /* ---------- Prefetch internal pages on intent for quick navigation ---------- */
  if (!conn.saveData) {
    var seen = new Set();
    var prefetch = function (a) {
      var u;
      try { u = new URL(a.href, location.href); } catch (e) { return; }
      if (u.origin !== location.origin || u.pathname === location.pathname || seen.has(u.pathname)) return;
      seen.add(u.pathname);
      var l = doc.createElement('link');
      l.rel = 'prefetch'; l.href = u.pathname;
      doc.head.appendChild(l);
    };
    Array.prototype.forEach.call(doc.querySelectorAll('a[href$=".html"]'), function (a) {
      a.addEventListener('pointerenter', function () { prefetch(a); }, { once: true });
      a.addEventListener('touchstart', function () { prefetch(a); }, { once: true, passive: true });
    });
  }
})();
