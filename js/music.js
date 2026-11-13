/* ==========================================================================
   music.js — background music + win / lose sounds (game page)
   Exposes a single global: TTTMusic

   Files live in assets/music/ :
     background tracks  -> list them in TRACKS below
     win sound          -> win.mp3
     lose sound         -> game-over.mp3
   To add or remove a background track, edit the TRACKS list.

   - Tracks are shuffled; when one ends the next (different) one fades in.
   - The music starts quietly with a fade-in. If the browser blocks sound
     on a fresh page, it starts on the player's first tap or key press.
   - Music has its own on/off switch (TTTStorage "music"), separate from
     the sound-effects switch. Win/lose sounds follow the sound-effects one.
   - Missing files fail quietly: music is simply skipped, and win/lose fall
     back to the built-in synthesized sounds.
   ========================================================================== */

(function () {
  "use strict";

  var BASE = "../assets/music/";
  var TRACKS = [
    "groundbird-minimal-shift.mp3",
    "coding-night.mp3",
    "many-moons-of-saturn.mp3",
    "chill-music.mp3"
  ];
  var STINGER_FILES = { win: "win.mp3", lose: "game-over.mp3" };

  var MUSIC_VOLUME = 0.3;   // normal background level (0 to 1)
  var DUCK_VOLUME = 0.06;   // background level while a win/lose sound plays
  var FADE_IN = 1.5;        // seconds
  var FADE_OUT = 0.6;
  var STINGER_VOLUME = 0.85;

  var audio = new Audio();
  audio.preload = "auto";

  // Web Audio gives smooth fades and works on iPhones (where audio.volume
  // can't be changed). It can't be used when the page is opened straight
  // from disk (file://), so there we fall back to plain audio.volume.
  var AC = window.AudioContext || window.webkitAudioContext;
  var useWebAudio = !!AC && window.location.protocol !== "file:";
  var ctx = null;
  var gain = null;
  var fadeTimer = null;
  var pauseTimer = null;

  var started = false;
  var pausedByPage = false;   // pause overlay is open
  var ducked = false;
  var failedAll = false;
  var failures = 0;
  var queue = [];
  var lastTrack = null;

  /* ---------------------------------------------------------------- */
  /* helpers                                                           */
  /* ---------------------------------------------------------------- */

  function musicOn() {
    return !(window.TTTStorage && window.TTTStorage.getMusicOn() === false);
  }

  function soundOn() {
    return !(window.TTTStorage && window.TTTStorage.getSoundOn() === false);
  }

  function canPlay() {
    return started && musicOn() && !pausedByPage && !document.hidden && !failedAll;
  }

  function targetLevel() {
    return ducked ? DUCK_VOLUME : MUSIC_VOLUME;
  }

  function ensureGraph() {
    if (!useWebAudio || ctx) return;
    try {
      ctx = new AC();
      var source = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      gain = null;
      useWebAudio = false;
    }
  }

  function hardLevel(v) {
    clearInterval(fadeTimer);
    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.value = v;
    } else {
      audio.volume = v;
    }
  }

  function setLevel(target, seconds) {
    clearInterval(fadeTimer);
    if (gain) {
      var now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(target, now, Math.max(seconds, 0.05) / 3);
    } else {
      var from = audio.volume;
      var steps = Math.max(1, Math.round((seconds * 1000) / 50));
      var i = 0;
      fadeTimer = setInterval(function () {
        i++;
        audio.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
        if (i >= steps) clearInterval(fadeTimer);
      }, 50);
    }
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  /** Picks the next track from a shuffled queue, never repeating the one
   *  that just played. */
  function pickTrack() {
    if (!queue.length) {
      queue = shuffle(TRACKS.slice());
      if (queue.length > 1 && queue[0] === lastTrack) queue.push(queue.shift());
    }
    lastTrack = queue.shift();
    audio.src = BASE + lastTrack;
  }

  /* ---------------------------------------------------------------- */
  /* playback                                                          */
  /* ---------------------------------------------------------------- */

  /** Starts (or resumes) the music with a fade-in, if it's allowed to. */
  function begin() {
    if (!canPlay()) return;
    clearTimeout(pauseTimer);
    ensureGraph();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});

    if (!audio.paused) {          // still fading out: just fade back up
      setLevel(targetLevel(), FADE_IN);
      return;
    }
    if (!audio.src) pickTrack();
    hardLevel(0);
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { setLevel(targetLevel(), FADE_IN); },
             function () { /* blocked for now: the first tap retries */ });
    } else {
      setLevel(targetLevel(), FADE_IN);
    }
  }

  function fadeOutAndPause(seconds) {
    if (audio.paused) return;
    setLevel(0, seconds);
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(function () {
      if (!canPlay()) audio.pause();
    }, seconds * 1000 + 120);
  }

  audio.addEventListener("playing", function () { failures = 0; });

  audio.addEventListener("ended", function () {
    pickTrack();
    begin();
  });

  audio.addEventListener("error", function () {
    failures++;
    if (failures >= TRACKS.length) { failedAll = true; return; }
    pickTrack();
    begin();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) fadeOutAndPause(0.3);
    else begin();
  });

  // Browsers often refuse to play sound until the player interacts with the
  // page. Any first tap / key press gets the music going.
  function unlock() {
    if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
    if (canPlay() && audio.paused) begin();
  }
  ["pointerdown", "keydown", "touchend"].forEach(function (evt) {
    document.addEventListener(evt, unlock, { passive: true });
  });

  /* ---------------------------------------------------------------- */
  /* win / lose sounds                                                 */
  /* ---------------------------------------------------------------- */

  var stingers = {};
  var activeStinger = null;
  var stingerTimer = null;

  function getStinger(kind) {
    var file = STINGER_FILES[kind];
    if (!file) return null;
    if (!stingers[kind]) {
      var el = new Audio(BASE + file);
      el.preload = "auto";
      el.volume = STINGER_VOLUME;
      var entry = { el: el, failed: false };
      el.addEventListener("error", function () { entry.failed = true; });
      stingers[kind] = entry;
    }
    return stingers[kind];
  }

  function synth(kind) {
    if (window.TTTSound) window.TTTSound.play(kind);
  }

  function duck(on) {
    ducked = on;
    if (!audio.paused && canPlay()) setLevel(targetLevel(), on ? 0.3 : 1.5);
  }

  /** kind: "win" | "lose" | "draw" */
  function playResult(kind) {
    if (!soundOn()) return;
    var st = getStinger(kind);
    if (!st || st.failed) { synth(kind); return; }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(stingerTimer);
      duck(false);
    }

    activeStinger = st;
    duck(true);
    st.el.onended = finish;
    clearTimeout(stingerTimer);
    stingerTimer = setTimeout(finish, 9000);   // safety net
    try {
      st.el.currentTime = 0;
      var p = st.el.play();
      if (p && p.catch) p.catch(function () { finish(); synth(kind); });
    } catch (e) {
      finish();
      synth(kind);
    }
  }

  /** Called when a new game starts: cut any win/lose sound short and bring
   *  the music back up. */
  function stopResult() {
    clearTimeout(stingerTimer);
    if (activeStinger) {
      try { activeStinger.el.pause(); } catch (e) { /* ignore */ }
      activeStinger = null;
    }
    if (ducked) duck(false);
  }

  /* ---------------------------------------------------------------- */
  /* public API                                                        */
  /* ---------------------------------------------------------------- */

  window.TTTMusic = {
    /** Call once when the game page is ready. */
    start: function () {
      if (started) return;
      started = true;
      getStinger("win");
      getStinger("lose");
      begin();
    },
    isEnabled: musicOn,
    setEnabled: function (on) {
      if (window.TTTStorage) window.TTTStorage.setMusicOn(on);
      if (!started) return;
      if (on) begin();
      else fadeOutAndPause(FADE_OUT);
    },
    /** True while the pause overlay is open. */
    setPaused: function (paused) {
      pausedByPage = paused;
      if (paused) fadeOutAndPause(FADE_OUT);
      else begin();
    },
    playResult: playResult,
    stopResult: stopResult
  };
})();