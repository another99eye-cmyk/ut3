/* ==========================================================================
   animation.js — scroll-reveal + hero parallax
   Exposes: window.TTTAnimation.init()
   ========================================================================== */

(function () {
  "use strict";

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    // stagger index within each group
    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty("--i", i);
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  function initParallax() {
    if (prefersReducedMotion()) return;

    var stage = document.querySelector(".hero__board-stage");
    var stickers = document.querySelectorAll(".sticker");
    if (!stage || !stickers.length) return;

    var raf = null;

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        var y = window.scrollY;
        stickers.forEach(function (el, i) {
          var speed = 0.04 + (i % 3) * 0.03;
          el.style.transform = "translateY(" + (y * speed * -1) + "px)";
        });
        raf = null;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* hero device: stagger the pieces popping in, and pause the loop when it's off screen */
  function initDevice() {
    var stage = document.querySelector("[data-device-stage]");
    if (!stage) return;

    stage.querySelectorAll(".cell svg").forEach(function (svg, i) {
      svg.style.setProperty("--n", i);
    });

    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      stage.classList.toggle("is-paused", !entries[entries.length - 1].isIntersecting);
    }).observe(stage);
  }

  /* ---------------------------------------------------------------- */
  /* game-page effects                                                  */
  /* ---------------------------------------------------------------- */

  function boardEntrance(boardEl) {
    if (!boardEl) return;
    var locals = boardEl.querySelectorAll(".local-board");
    if (prefersReducedMotion()) {
      locals.forEach(function (el) { el.classList.add("local-board--entered"); });
      return;
    }
    locals.forEach(function (el, i) {
      el.style.animationDelay = (i * 45) + "ms";
      el.classList.add("local-board--enter");
    });
  }

  function restartShake(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // restart the animation even if it's already applied
    el.classList.add(className);
  }

  function shakeCell(cellEl) {
    if (prefersReducedMotion()) return;
    restartShake(cellEl, "shake");
  }

  function popCell(cellEl) {
    if (prefersReducedMotion()) return;
    restartShake(cellEl, "cell--pop");
  }

  function celebrateBoard(localBoardEl) {
    localBoardEl.classList.remove("local-board--celebrate");
    if (prefersReducedMotion()) return;
    void localBoardEl.offsetWidth;
    localBoardEl.classList.add("local-board--celebrate");
  }

  function celebrateGlobalWin(boardEl, winner) {
    boardEl.classList.add("ultimate-board--won");
    if (prefersReducedMotion()) return;
    spawnConfetti(boardEl, winner);
  }

  function spawnConfetti(container, winner) {
    var colorVar = winner === "X" ? "--x-color" : "--o-color";
    var layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");
    var count = 32;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = (Math.random() * 100) + "%";
      piece.style.setProperty("--c", i % 2 === 0 ? "var(" + colorVar + ")" : "var(--accent)");
      piece.style.setProperty("--rot", (Math.random() * 360) + "deg");
      piece.style.setProperty("--delay", (Math.random() * 250) + "ms");
      piece.style.setProperty("--dur", (1200 + Math.random() * 900) + "ms");
      piece.style.setProperty("--drift", ((Math.random() - 0.5) * 140) + "px");
      layer.appendChild(piece);
    }
    container.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 2800);
  }

  /* ---------------------------------------------------------------- */
  /* tiny synthesized sound cues — no audio files needed                */
  /* ---------------------------------------------------------------- */

  var audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function blip(freq, duration, type, gainAmt) {
    if (window.TTTStorage && window.TTTStorage.getSoundOn() === false) return;
    var c = ctx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainAmt;
    osc.connect(gain).connect(c.destination);
    var now = c.currentTime;
    gain.gain.setValueAtTime(gainAmt, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }

  var TTTSound = {
    play: function (kind) {
      try {
        if (kind === "place") blip(520, 0.12, "triangle", 0.08);
        else if (kind === "invalid") blip(140, 0.15, "square", 0.05);
        else if (kind === "win") { blip(660, 0.18, "triangle", 0.09); setTimeout(function () { blip(880, 0.25, "triangle", 0.09); }, 140); }
        else if (kind === "lose") { blip(330, 0.22, "triangle", 0.08); setTimeout(function () { blip(220, 0.4, "triangle", 0.08); }, 170); }
        else if (kind === "draw") blip(300, 0.3, "sine", 0.06);
        else if (kind === "click") blip(440, 0.08, "triangle", 0.05);
      } catch (e) { /* audio unavailable, fail silently */ }
    }
  };

  window.TTTAnimation = {
    init: function () {
      initReveal();
      initParallax();
      initDevice();
    },
    prefersReducedMotion: prefersReducedMotion,
    boardEntrance: boardEntrance,
    shakeCell: shakeCell,
    popCell: popCell,
    celebrateBoard: celebrateBoard,
    celebrateGlobalWin: celebrateGlobalWin
  };
  window.TTTSound = TTTSound;
})();