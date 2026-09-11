/* ==========================================================================
   main.js — landing page UI logic (theme, mode + difficulty selection)
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* theme                                                             */
  /* ---------------------------------------------------------------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var toggle = document.querySelector(".theme-toggle");
    if (toggle) toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  function initTheme() {
    var stored = window.TTTStorage.getTheme();
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored || (systemDark ? "dark" : "light"));

    var toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      window.TTTStorage.setTheme(next);
    });
  }

  /* ---------------------------------------------------------------- */
  /* mode + difficulty selection                                       */
  /* ---------------------------------------------------------------- */

  function initModePicker() {
    var cards = document.querySelectorAll(".mode-card");
    if (!cards.length) return;

    var settings = window.TTTStorage.getSettings();

    function selectCard(card) {
      cards.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === card));
      });
      settings.mode = card.dataset.mode;
      if (card.dataset.mode !== "ai") settings.difficulty = null;
      window.TTTStorage.setSettings(settings);
      updateCta();
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function () { selectCard(card); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(card);
        }
      });
    });

    var chips = document.querySelectorAll(".chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        settings.difficulty = chip.dataset.difficulty;
        window.TTTStorage.setSettings(settings);
        updateCta();
      });
    });

    // restore previous selection, if any
    var savedCard = document.querySelector('.mode-card[data-mode="' + settings.mode + '"]');
    if (savedCard) selectCard(savedCard);
    if (settings.difficulty) {
      var savedChip = document.querySelector('.chip[data-difficulty="' + settings.difficulty + '"]');
      if (savedChip) savedChip.setAttribute("aria-pressed", "true");
    }

    function updateCta() {
      var cta = document.querySelector(".mode-picker__cta a");
      if (!cta) return;
      var params = new URLSearchParams();
      params.set("mode", settings.mode);
      if (settings.mode === "ai") params.set("difficulty", settings.difficulty || "easy");
      cta.href = "pages/game.html?" + params.toString();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initModePicker();
    if (window.TTTAnimation) window.TTTAnimation.init();
  });
})();
