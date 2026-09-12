/* ==========================================================================
   main.js — landing page UI logic (theme, mode/symbol/difficulty selection,
   win board)
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
  /* mode + symbol + difficulty selection                              */
  /* ---------------------------------------------------------------- */

  function initModePicker() {
    var cards = document.querySelectorAll(".mode-card");
    if (!cards.length) return;

    var settings = window.TTTStorage.getSettings();
    var symbolChips = document.querySelectorAll(".chip[data-symbol]");
    var difficultyChips = document.querySelectorAll(".chip[data-difficulty]");

    function selectCard(card) {
      cards.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === card));
      });
      settings.mode = card.dataset.mode;
      if (card.dataset.mode === "ai" && !settings.difficulty) {
        settings.difficulty = "medium";
      }
      window.TTTStorage.setSettings(settings);
      syncChips();
      updateCta();
    }

    function syncChips() {
      difficultyChips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c.dataset.difficulty === settings.difficulty));
      });
      symbolChips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c.dataset.symbol === settings.playerSymbol));
      });
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

    difficultyChips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        difficultyChips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        settings.difficulty = chip.dataset.difficulty;
        window.TTTStorage.setSettings(settings);
        updateCta();
      });
    });

    symbolChips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        symbolChips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        settings.playerSymbol = chip.dataset.symbol;
        window.TTTStorage.setSettings(settings);
        updateCta();
      });
    });

    // restore previous selection, if any (selectCard also syncs the chip rows)
    var savedCard = document.querySelector('.mode-card[data-mode="' + settings.mode + '"]');
    if (savedCard) selectCard(savedCard);

    function updateCta() {
      var cta = document.querySelector(".mode-picker__cta");
      if (!cta) return;
      // The Online card has its own Create/Join actions instead of a
      // generic Start button.
      cta.hidden = settings.mode === "online";
      if (cta.hidden) return;
      var link = cta.querySelector("a");
      var params = new URLSearchParams();
      params.set("mode", settings.mode);
      if (settings.mode === "ai") {
        params.set("difficulty", settings.difficulty || "medium");
        params.set("symbol", settings.playerSymbol || "X");
      }
      link.href = "pages/game.html?" + params.toString();
    }
  }

  /* ---------------------------------------------------------------- */
  /* online mode — create/join room controls on the Online card        */
  /* ---------------------------------------------------------------- */

  function initOnlinePanel() {
    var createBtn = document.getElementById("create-room-btn");
    var joinBtn = document.getElementById("join-room-btn");
    var codeInput = document.getElementById("join-room-code");
    if (!createBtn || !joinBtn || !codeInput || !window.TTTOnline) return;

    createBtn.addEventListener("click", function () {
      var code = window.TTTOnline.randomRoomCode();
      window.location.href = "pages/game.html?mode=online&role=host&room=" + code;
    });

    function attemptJoin() {
      var code = window.TTTOnline.normalizeCode(codeInput.value);
      if (!code) {
        codeInput.focus();
        if (window.TTTAnimation) window.TTTAnimation.shakeCell(codeInput);
        return;
      }
      window.location.href = "pages/game.html?mode=online&role=guest&room=" + code;
    }

    joinBtn.addEventListener("click", attemptJoin);
    codeInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        attemptJoin();
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* win board — persisted match results shown on the landing page     */
  /* ---------------------------------------------------------------- */

  function renderWinBoard() {
    var root = document.getElementById("win-board");
    if (!root) return;
    var stats = window.TTTStorage.getStats();

    var p1 = document.getElementById("wb-p1");
    var p2 = document.getElementById("wb-p2");
    var tpDraws = document.getElementById("wb-tp-draws");
    var player = document.getElementById("wb-player");
    var ai = document.getElementById("wb-ai");
    var aiDraws = document.getElementById("wb-ai-draws");
    var onlineYou = document.getElementById("wb-online-you");
    var onlineOpp = document.getElementById("wb-online-opponent");
    var onlineDraws = document.getElementById("wb-online-draws");

    if (p1) p1.textContent = stats.twoPlayer.p1Wins;
    if (p2) p2.textContent = stats.twoPlayer.p2Wins;
    if (tpDraws) tpDraws.textContent = stats.twoPlayer.draws;
    if (player) player.textContent = stats.ai.playerWins;
    if (ai) ai.textContent = stats.ai.aiWins;
    if (aiDraws) aiDraws.textContent = stats.ai.draws;
    if (onlineYou) onlineYou.textContent = stats.online.youWins;
    if (onlineOpp) onlineOpp.textContent = stats.online.opponentWins;
    if (onlineDraws) onlineDraws.textContent = stats.online.draws;
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initModePicker();
    initOnlinePanel();
    renderWinBoard();
    if (window.TTTAnimation) window.TTTAnimation.init();
  });

  // Re-render if the page is restored from the back/forward cache after a
  // match on game.html — DOMContentLoaded won't fire again in that case.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) renderWinBoard();
  });
})();
