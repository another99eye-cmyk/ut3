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

  var TTTStorage = {
    getTheme: function () {
      return safeGet("theme", null); // "light" | "dark" | null (=> follow system)
    },
    setTheme: function (theme) {
      return safeSet("theme", theme);
    },

    getSettings: function () {
      return safeGet("settings", { mode: "two-player", difficulty: null });
    },
    setSettings: function (settings) {
      return safeSet("settings", settings);
    },

    getSoundOn: function () {
      return safeGet("sound", true);
    },
    setSoundOn: function (on) {
      return safeSet("sound", on);
    },

    getStats: function () {
      return safeGet("stats", { xWins: 0, oWins: 0, draws: 0 });
    },
    setStats: function (stats) {
      return safeSet("stats", stats);
    },
    recordResult: function (winner) {
      var stats = TTTStorage.getStats();
      if (winner === "X") stats.xWins++;
      else if (winner === "O") stats.oWins++;
      else stats.draws++;
      TTTStorage.setStats(stats);
      return stats;
    }
  };

  window.TTTStorage = TTTStorage;
})();
