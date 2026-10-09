/* OZÉVO RARE — page choreography
   1) words light up as the statement scrolls into view
   2) sticky scroll story: the phone turns through three angles (finish → storage → battery)
   3) quick-facts bar appears after the opening and steps aside for the closing section
   Requires js/motion.js (loaded first). Falls back to a plain, fully readable page. */
(function () {
  'use strict';
  var OZ = window.OZ || { reduced: false, lite: false, motion: true, countUp: function () {} };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var vh = function () { return window.innerHeight; };

  /* ---------- 1. Statement words ---------- */
  var words = document.querySelector('[data-words]');
  var wordEls = [];
  if (words && OZ.motion) {
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var s = document.createElement('span');
            s.className = 'w'; s.textContent = part;
            frag.appendChild(s); wordEls.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { wrap(n); }
      });
    })(words);
    words.classList.add('js-words');
  }
  function updateWords() {
    if (!wordEls.length) return;
    var r = words.getBoundingClientRect();
    var p = clamp((vh() * 0.82 - r.top) / (r.height + vh() * 0.2), 0, 1);
    var on = Math.round(p * wordEls.length);
    for (var i = 0; i < wordEls.length; i++) {
      var shouldOn = i < on;
      if (wordEls[i]._on !== shouldOn) { wordEls[i]._on = shouldOn; wordEls[i].classList.toggle('on', shouldOn); }
    }
  }

  /* ---------- 2. Scroll story ---------- */
  var story = document.querySelector('[data-story]');
  var storyReady = false, obj, steps, dots, activeStep = -1;
  var poses = [
    { ry: -16, rx: 5,  s: 1.00 },   // finish
    { ry: -40, rx: 3,  s: 1.05 },   // storage
    { ry:  36, rx: -3, s: 1.05 }    // battery
  ];
  if (story && OZ.motion) {
    obj = story.querySelector('.r-obj');
    var face = obj && obj.querySelector('.r-face');
    steps = Array.prototype.slice.call(story.querySelectorAll('.r-step'));
    dots = Array.prototype.slice.call(story.querySelectorAll('.r-progress li'));
    if (face && steps.length === poses.length) {
      // build the phone's thickness from stacked, darkened copies of the same render
      var small = window.innerWidth < 700;
      var layers = small ? 8 : 14, gap = small ? 2.6 : 2.2;
      for (var i = 1; i <= layers; i++) {
        var e = face.cloneNode(false);
        e.className = 'r-edge'; e.alt = ''; e.setAttribute('aria-hidden', 'true');
        e.style.transform = 'translateZ(' + (-i * gap).toFixed(1) + 'px)';
        e.style.filter = 'brightness(' + (i <= 2 ? 0.9 : (0.52 - (i / layers) * 0.16)).toFixed(2) + ')';
        obj.appendChild(e);
      }
      story.classList.add('js-story');
      storyReady = true;
    }
  }
  function setStep(k) {
    if (k === activeStep) return;
    activeStep = k;
    steps.forEach(function (s, idx) { s.classList.toggle('is-active', idx === k); });
    dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === k); });
    var counter = steps[k].querySelector('[data-count-manual]');
    if (counter) OZ.countUp(counter);
  }
  function updateStory() {
    if (!storyReady) return;
    var r = story.getBoundingClientRect();
    var total = story.offsetHeight - vh();
    var p = clamp(-r.top / total, 0, 1);
    var N = poses.length;
    var f = Math.min(p * N, N - 0.0001), i = Math.floor(f), frac = f - i;
    var t = i < N - 1 ? smooth(clamp((frac - 0.55) / 0.45, 0, 1)) : 0;   // hold, then turn
    var a = poses[i], b = poses[Math.min(i + 1, N - 1)];
    var lerp = function (x, y) { return x + (y - x) * t; };
    var ry = lerp(a.ry, b.ry);
    obj.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    obj.style.setProperty('--rx', lerp(a.rx, b.rx).toFixed(2) + 'deg');
    obj.style.setProperty('--s', lerp(a.s, b.s).toFixed(3));
    obj.style.setProperty('--ty', ((0.5 - p) * 28).toFixed(1) + 'px');
    obj.style.setProperty('--gl', (ry * 1.3).toFixed(1));
    setStep((i < N - 1 && frac > 0.72) ? i + 1 : i);
  }

  /* ---------- 3. Quick-facts bar ---------- */
  var bar = document.querySelector('.r-buybar');
  var open = document.querySelector('.r-open');
  var close = document.getElementById('choose');
  function updateBar() {
    if (!bar || !open) return;
    var passed = open.getBoundingClientRect().bottom < vh() * 0.25;
    var atEnd = close && close.getBoundingClientRect().top < vh() * 0.55;
    bar.classList.toggle('is-visible', passed && !atEnd);
  }

  var ticking = false;
  function frame() { ticking = false; updateWords(); updateStory(); updateBar(); }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if (storyReady) setStep(0);
  frame();
})();
