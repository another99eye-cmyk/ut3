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

  window.TTTAnimation = {
    init: function () {
      initReveal();
      initParallax();
    }
  };
})();
