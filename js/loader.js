/* ==========================================================================
   loader.js — hides the page loader (index.html and game.html)

   The loader stays up until BOTH are true:
     1. the page has finished loading, and
     2. it has been on screen for at least MIN_MS (so it never just flashes).
   If the page takes unusually long (slow network, a stalled script from a
   CDN), it is hidden after MAX_MS anyway so the player is never stuck.
   ========================================================================== */

(function () {
  "use strict";

  var MIN_MS = 500;    // always visible at least this long
  var MAX_MS = 5000;   // never visible longer than this

  var loader = document.getElementById("page-loader");
  if (!loader) return;

  var root = document.documentElement;
  var startedAt = Date.now();
  var loaded = document.readyState === "complete";
  var finished = false;

  root.classList.add("is-loading");

  function remove() {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }

  function hide() {
    if (finished) return;
    finished = true;
    root.classList.remove("is-loading");
    loader.classList.add("is-hiding");
    loader.setAttribute("aria-hidden", "true");
    // Remove it from the page once the fade-out has finished.
    setTimeout(remove, 500);
  }

  function maybeHide() {
    if (finished || !loaded) return;
    var remaining = MIN_MS - (Date.now() - startedAt);
    if (remaining <= 0) hide();
    else setTimeout(hide, remaining);
  }

  if (loaded) {
    maybeHide();
  } else {
    window.addEventListener("load", function () {
      loaded = true;
      maybeHide();
    });
  }

  setTimeout(hide, MAX_MS);
})();