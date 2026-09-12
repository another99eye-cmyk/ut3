/* ==========================================================================
   storage.js — localStorage wrapper for theme, mode settings, and stats
   Exposes a single global: TTTStorage
   ========================================================================== */

(function () {
  "use strict";

  var NAMESPACE = "ultimateTTT";

  function key(name) {
    return NAMESPACE + ":" + name;
  }

  function safeGet(name, fallback) {
    try {
      var raw = window.localStorage.getItem(key(name));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function safeSet(name, value) {
    try {
      window.localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function defaultStats() {
    return {
      twoPlayer: { p1Wins: 0, p2Wins: 0, draws: 0 },
      ai: { playerWins: 0, aiWins: 0, draws: 0 },
      online: { youWins: 0, opponentWins: 0, draws: 0 }
    };
  }

  var TTTStorage = {
    getTheme: function () {
      return safeGet("theme", null); // "light" | "dark" | null (=> follow system)
    },
    setTheme: function (theme) {
      return safeSet("theme", theme);
    },

    getSoundOn: function () {
      return safeGet("sound", true);
    },
    setSoundOn: function (on) {
      return safeSet("sound", on);
    },

    /* mode: "two-player" | "ai"
       difficulty: "easy" | "medium" | "hard" | null
       playerSymbol: "X" | "O" — the human's chosen symbol in AI mode,
       picked on the landing page's AI card and fixed for the match. */
    getSettings: function () {
      var s = safeGet("settings", null) || {};
      return {
        mode: s.mode || "two-player",
        difficulty: s.difficulty || null,
        playerSymbol: s.playerSymbol === "O" ? "O" : "X"
      };
    },
    setSettings: function (settings) {
      return safeSet("settings", settings);
    },

    /* Which symbol Player 1 holds for the *next* two-player match. Starts
       at "X" and flips every time a two-player match finishes, so symbols
       alternate automatically without a trip back to the landing page. */
    getTwoPlayerStartSymbol: function () {
      var v = safeGet("twoPlayerStartSymbol", "X");
      return v === "O" ? "O" : "X";
    },
    setTwoPlayerStartSymbol: function (symbol) {
      return safeSet("twoPlayerStartSymbol", symbol === "O" ? "O" : "X");
    },
    toggleTwoPlayerStartSymbol: function () {
      var next = TTTStorage.getTwoPlayerStartSymbol() === "X" ? "O" : "X";
      TTTStorage.setTwoPlayerStartSymbol(next);
      return next;
    },

    /* Stats are tracked per player/role, not per symbol, so they stay
       correct even though symbols swap (two player) or are chosen
       freely (AI mode). */
    getStats: function () {
      var s = safeGet("stats", null);
      if (!s || !s.twoPlayer || !s.ai || !s.online) {
        var d = defaultStats();
        return {
          twoPlayer: (s && s.twoPlayer) || d.twoPlayer,
          ai: (s && s.ai) || d.ai,
          online: (s && s.online) || d.online
        };
      }
      return s;
    },
    setStats: function (stats) {
      return safeSet("stats", stats);
    },

    /** bucket: "twoPlayer" | "ai" | "online"
     *  outcome: "twoPlayer" bucket -> "p1" | "p2" | "draw"
     *           "ai" bucket       -> "player" | "ai" | "draw"
     *           "online" bucket   -> "you" | "opponent" | "draw" */
    recordResult: function (bucket, outcome) {
      var stats = TTTStorage.getStats();
      if (bucket === "ai") {
        if (outcome === "player") stats.ai.playerWins++;
        else if (outcome === "ai") stats.ai.aiWins++;
        else stats.ai.draws++;
      } else if (bucket === "online") {
        if (outcome === "you") stats.online.youWins++;
        else if (outcome === "opponent") stats.online.opponentWins++;
        else stats.online.draws++;
      } else {
        if (outcome === "p1") stats.twoPlayer.p1Wins++;
        else if (outcome === "p2") stats.twoPlayer.p2Wins++;
        else stats.twoPlayer.draws++;
      }
      TTTStorage.setStats(stats);
      return stats;
    }
  };

  window.TTTStorage = TTTStorage;
})();
