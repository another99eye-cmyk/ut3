/* ==========================================================================
   main.js — landing page UI logic (theme, mode cards + pop-ups, win board)
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
  /* scroll-aware header                                               */
  /*   - shrinks and firms up after a little scrolling                 */
  /*   - slides away while scrolling down, returns on scroll up        */
  /* ---------------------------------------------------------------- */

  function initScrollHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    var SHRINK_AT = 24;   // px scrolled before the header shrinks
    var HIDE_AFTER = 160; // px scrolled before it may hide
    var DELTA = 8;        // ignore tiny movements so it doesn't flicker
    var lastY = Math.max(0, window.scrollY);
    var ticking = false;

    function update() {
      ticking = false;
      var y = Math.max(0, window.scrollY); // iOS can report negative values while bouncing
      header.classList.toggle("is-scrolled", y > SHRINK_AT);

      var diff = y - lastY;
      if (Math.abs(diff) >= DELTA) {
        if (diff > 0 && y > HIDE_AFTER && !header.contains(document.activeElement)) {
          header.classList.add("is-hidden");
        } else if (diff < 0) {
          header.classList.remove("is-hidden");
        }
        lastY = y;
      }
      if (y <= SHRINK_AT) header.classList.remove("is-hidden");
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    // Tabbing into the header with the keyboard always brings it back.
    header.addEventListener("focusin", function () { header.classList.remove("is-hidden"); });

    update();
  }

  /* ---------------------------------------------------------------- */
  /* mode cards + pop-ups                                              */
  /*   Two Player -> starts straight away                              */
  /*   Play the AI -> pop-up: side + difficulty -> Start game          */
  /*   Online      -> pop-up: create a room / join with a code         */
  /* ---------------------------------------------------------------- */

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function initDialogClosing() {
    document.querySelectorAll(".mode-dialog").forEach(function (dialog) {
      dialog.querySelectorAll("[data-close]").forEach(function (btn) {
        btn.addEventListener("click", function () { dialog.close(); });
      });
      // The card fills the whole dialog box, so a click that lands on the
      // dialog itself is a click on the dimmed backdrop.
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) dialog.close();
      });
    });
  }

  function initModePicker() {
    var cards = document.querySelectorAll(".mode-card");
    if (!cards.length) return;

    var settings = window.TTTStorage.getSettings();
    var aiDialog = document.getElementById("ai-dialog");
    var onlineDialog = document.getElementById("online-dialog");

    function save(mode) {
      settings.mode = mode;
      window.TTTStorage.setSettings(settings);
    }

    function goTo(params) {
      window.location.href = "pages/game.html?" + params.toString();
    }

    /* ---- Play the AI pop-up ---- */
    var symbolChips = aiDialog ? aiDialog.querySelectorAll(".chip[data-symbol]") : [];
    var difficultyChips = aiDialog ? aiDialog.querySelectorAll(".chip[data-difficulty]") : [];
    var levelHint = document.getElementById("ai-level-hint");
    var startBtn = document.getElementById("ai-start-btn");

    function syncAiChips() {
      var level = settings.difficulty || "medium";
      var side = settings.playerSymbol === "O" ? "O" : "X";
      difficultyChips.forEach(function (c) {
        var on = c.dataset.difficulty === level;
        c.setAttribute("aria-pressed", String(on));
        if (on && levelHint) levelHint.textContent = c.dataset.hint || "";
      });
      symbolChips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c.dataset.symbol === side));
      });
    }

    difficultyChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        settings.difficulty = chip.dataset.difficulty;
        window.TTTStorage.setSettings(settings);
        syncAiChips();
      });
    });

    symbolChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        settings.playerSymbol = chip.dataset.symbol;
        window.TTTStorage.setSettings(settings);
        syncAiChips();
      });
    });

    if (startBtn) {
      startBtn.addEventListener("click", function () {
        save("ai");
        var params = new URLSearchParams();
        params.set("mode", "ai");
        params.set("difficulty", settings.difficulty || "medium");
        params.set("symbol", settings.playerSymbol === "O" ? "O" : "X");
        goTo(params);
      });
    }

    /* ---- the three cards ---- */
    function activate(card) {
      var mode = card.dataset.mode;
      if (mode === "ai") {
        syncAiChips();
        openDialog(aiDialog);
      } else if (mode === "online") {
        resetJoinError();
        openDialog(onlineDialog);
      } else {
        save("two-player");
        var params = new URLSearchParams();
        params.set("mode", "two-player");
        goTo(params);
      }
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function () { activate(card); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(card);
        }
      });
    });

    /* ---- Online pop-up ---- */
    var createBtn = document.getElementById("create-room-btn");
    var joinBtn = document.getElementById("join-room-btn");
    var codeInput = document.getElementById("join-room-code");
    var joinError = document.getElementById("join-error");

    function resetJoinError() {
      if (joinError) { joinError.hidden = true; joinError.textContent = ""; }
    }

    if (createBtn && joinBtn && codeInput && window.TTTOnline) {
      createBtn.addEventListener("click", function () {
        save("online");
        var code = window.TTTOnline.randomRoomCode();
        window.location.href = "pages/game.html?mode=online&role=host&room=" + code;
      });

      var attemptJoin = function () {
        var code = window.TTTOnline.normalizeCode(codeInput.value);
        if (!code) {
          if (joinError) {
            joinError.textContent = "Enter the room code your friend sent you.";
            joinError.hidden = false;
          }
          codeInput.focus();
          if (window.TTTAnimation) window.TTTAnimation.shakeCell(codeInput);
          return;
        }
        save("online");
        window.location.href = "pages/game.html?mode=online&role=guest&room=" + code;
      };

      joinBtn.addEventListener("click", attemptJoin);
      codeInput.addEventListener("input", resetJoinError);
      codeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          attemptJoin();
        }
      });
    }

    initDialogClosing();
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
    initScrollHeader();
    initModePicker();
    renderWinBoard();
    if (window.TTTAnimation) window.TTTAnimation.init();
  });

  // Re-render if the page is restored from the back/forward cache after a
  // match on game.html — DOMContentLoaded won't fire again in that case.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      renderWinBoard();
      // Coming back with the browser's Back button: start from a clean page.
      document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
    }
  });
})();