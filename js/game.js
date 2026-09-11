/* ==========================================================================
   game.js — Ultimate Tic-Tac-Toe rules engine + game-page controller
   Exposes window.TTTGame.Engine for reuse (e.g. by ai.js later).
   ========================================================================== */

window.TTTGame = window.TTTGame || {};

(function () {
  "use strict";

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function checkLineWinner(cells) {
    for (var i = 0; i < LINES.length; i++) {
      var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
      if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
        return { winner: cells[a], line: [a, b, c] };
      }
    }
    return null;
  }

  function isFull(cells) {
    for (var i = 0; i < cells.length; i++) if (cells[i] === "") return false;
    return true;
  }

  /* ----------------------------------------------------------------------
     GameEngine — owns the full board state and enforces the rules.
     Kept free of any DOM access so it can be cloned/simulated by ai.js.
  ---------------------------------------------------------------------- */

  function GameEngine() {
    this.reset();
  }

  GameEngine.prototype.reset = function () {
    this.boards = [];
    for (var i = 0; i < 9; i++) this.boards.push(["", "", "", "", "", "", "", "", ""]);
    this.boardStatus = [null, null, null, null, null, null, null, null, null];
    this.boardWinLines = [null, null, null, null, null, null, null, null, null];
    this.currentPlayer = "X";
    this.activeBoard = null; // null => any open board is legal
    this.globalStatus = null; // null | "X" | "O" | "D"
    this.globalWinLine = null;
    this.moveCount = 0;
    this.lastMove = null;
  };

  GameEngine.prototype.clone = function () {
    var copy = new GameEngine();
    copy.boards = this.boards.map(function (b) { return b.slice(); });
    copy.boardStatus = this.boardStatus.slice();
    copy.boardWinLines = this.boardWinLines.slice();
    copy.currentPlayer = this.currentPlayer;
    copy.activeBoard = this.activeBoard;
    copy.globalStatus = this.globalStatus;
    copy.globalWinLine = this.globalWinLine;
    copy.moveCount = this.moveCount;
    copy.lastMove = this.lastMove;
    return copy;
  };

  GameEngine.prototype.legalBoards = function () {
    if (this.globalStatus) return [];
    if (this.activeBoard !== null && this.boardStatus[this.activeBoard] === null) {
      return [this.activeBoard];
    }
    var boards = [];
    for (var i = 0; i < 9; i++) if (this.boardStatus[i] === null) boards.push(i);
    return boards;
  };

  GameEngine.prototype.legalMoves = function () {
    var moves = [];
    var boards = this.legalBoards();
    for (var i = 0; i < boards.length; i++) {
      var b = boards[i];
      for (var c = 0; c < 9; c++) if (this.boards[b][c] === "") moves.push({ board: b, cell: c });
    }
    return moves;
  };

  GameEngine.prototype.isLegalMove = function (board, cell) {
    if (this.globalStatus) return false;
    if (this.boardStatus[board] !== null) return false;
    if (this.boards[board][cell] !== "") return false;
    if (this.activeBoard !== null && this.activeBoard !== board) return false;
    return true;
  };

  /** Apply a move. Returns a result descriptor, or null if illegal. */
  GameEngine.prototype.play = function (board, cell) {
    if (!this.isLegalMove(board, cell)) return null;

    var player = this.currentPlayer;
    this.boards[board][cell] = player;
    this.moveCount++;
    this.lastMove = { board: board, cell: cell, player: player };

    var localWon = false;
    var boardDrawn = false;

    var lineResult = checkLineWinner(this.boards[board]);
    if (lineResult) {
      this.boardStatus[board] = lineResult.winner;
      this.boardWinLines[board] = lineResult.line;
      localWon = true;
    } else if (isFull(this.boards[board])) {
      this.boardStatus[board] = "D";
      boardDrawn = true;
    }

    var globalWon = false;
    var globalDrawn = false;
    var metaCells = this.boardStatus.map(function (s) { return (s === "X" || s === "O") ? s : ""; });
    var metaResult = checkLineWinner(metaCells);
    if (metaResult) {
      this.globalStatus = metaResult.winner;
      this.globalWinLine = metaResult.line;
      globalWon = true;
    } else if (this.boardStatus.every(function (s) { return s !== null; })) {
      this.globalStatus = "D";
      globalDrawn = true;
    }

    var nextActive = cell;
    if (this.boardStatus[nextActive] !== null) nextActive = null;
    this.activeBoard = this.globalStatus ? null : nextActive;

    this.currentPlayer = player === "X" ? "O" : "X";

    return {
      board: board, cell: cell, player: player,
      localWon: localWon, boardDrawn: boardDrawn,
      globalWon: globalWon, globalDrawn: globalDrawn,
      boardWinner: this.boardStatus[board],
      winLine: this.boardWinLines[board],
      globalWinLine: this.globalWinLine
    };
  };

  window.TTTGame.Engine = GameEngine;
  window.TTTGame.checkLineWinner = checkLineWinner;

  /* ========================================================================
     Page controller — only runs on the game page.
     ======================================================================== */

  var boardEl = document.getElementById("ultimate-board");
  if (!boardEl) return; // Not on the game page; engine is still exposed above.

  var settings = window.TTTStorage.getSettings();
  var params = new URLSearchParams(window.location.search);
  var mode = params.get("mode") || settings.mode || "two-player";
  var difficulty = params.get("difficulty") || settings.difficulty || "medium";

  var engine = new GameEngine();
  var aiThinking = false; // reserved for ai.js; unused while AI mode is a stub

  var boardWrapEl = document.querySelector(".board-wrap");

  var els = {
    modeIndicator: document.getElementById("mode-indicator"),
    difficultyWrap: document.getElementById("difficulty-indicator-wrap"),
    difficultyIndicator: document.getElementById("difficulty-indicator"),
    turnLabel: document.getElementById("current-player-label"),
    turnDot: document.getElementById("current-player-dot"),
    scoreX: document.getElementById("score-x"),
    scoreO: document.getElementById("score-o"),
    scoreDraw: document.getElementById("score-draw"),
    nameX: document.getElementById("player-x-name"),
    nameO: document.getElementById("player-o-name"),
    restartBtn: document.getElementById("restart-btn"),
    menuBtn: document.getElementById("menu-btn"),
    soundToggle: document.getElementById("sound-toggle"),
    themeToggle: document.querySelector(".theme-toggle"),
    aiThinkingEl: document.getElementById("ai-thinking"),
    overlay: document.getElementById("victory-overlay"),
    overlayIcon: document.getElementById("victory-icon"),
    overlayTitle: document.getElementById("victory-title"),
    overlaySub: document.getElementById("victory-sub"),
    rematchBtn: document.getElementById("rematch-btn"),
    mainMenuBtn: document.getElementById("main-menu-btn"),
    liveRegion: document.getElementById("live-region")
  };

  /* ---------- Header meta ---------- */

  var difficultyLabels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  els.modeIndicator.textContent = mode === "ai" ? "Vs AI" : "Two player";
  els.nameO.textContent = mode === "ai" ? "AI" : "Player O";
  if (mode === "ai") {
    els.difficultyWrap.hidden = false;
    els.difficultyIndicator.textContent = difficultyLabels[difficulty] || "Medium";
  } else {
    els.difficultyWrap.hidden = true;
  }
  // In "ai" mode, O is always played by ai.js (see maybeTakeAiTurn()); X is
  // always the human.

  function refreshScoreboard() {
    var stats = window.TTTStorage.getStats();
    els.scoreX.textContent = stats.xWins;
    els.scoreO.textContent = stats.oWins;
    els.scoreDraw.textContent = stats.draws;
  }
  refreshScoreboard();

  /* ---------- Build the 9x9 board DOM ---------- */

  var localBoardEls = [];
  var cellEls = []; // cellEls[board][cell]

  for (var b = 0; b < 9; b++) {
    var local = document.createElement("div");
    local.className = "local-board";
    local.dataset.board = String(b);
    local.setAttribute("role", "group");
    local.setAttribute("aria-label", "Board " + (b + 1));

    var cellsRow = [];
    for (var c = 0; c < 9; c++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.board = String(b);
      cell.dataset.cell = String(c);
      cell.setAttribute("aria-label", "Board " + (b + 1) + ", cell " + (c + 1) + ", empty");
      cell.addEventListener("click", onCellClick);
      local.appendChild(cell);
      cellsRow.push(cell);
    }
    cellEls.push(cellsRow);

    var stamp = document.createElement("div");
    stamp.className = "local-board__stamp";
    stamp.setAttribute("aria-hidden", "true");
    local.appendChild(stamp);

    boardEl.appendChild(local);
    localBoardEls.push(local);
  }

  /* ---------- Rendering ---------- */

  function markerSVG(player) {
    var symbol = player === "X" ? "#glyph-x" : "#glyph-o";
    return '<svg viewBox="0 0 40 40" class="mark mark--' + player.toLowerCase() + '" aria-hidden="true"><use href="' + symbol + '"/></svg>';
  }

  function renderCell(b, c) {
    var val = engine.boards[b][c];
    var el = cellEls[b][c];
    el.innerHTML = val ? markerSVG(val) : "";
    el.classList.toggle("cell--x", val === "X");
    el.classList.toggle("cell--o", val === "O");
    el.disabled = !!val;
    el.setAttribute("aria-label", val
      ? "Board " + (b + 1) + ", cell " + (c + 1) + ", " + val
      : "Board " + (b + 1) + ", cell " + (c + 1) + ", empty");
  }

  function renderBoardStatus(b) {
    var status = engine.boardStatus[b];
    var el = localBoardEls[b];
    el.classList.remove("local-board--won-x", "local-board--won-o", "local-board--draw");
    var stamp = el.querySelector(".local-board__stamp");
    stamp.innerHTML = "";
    if (status === "X" || status === "O") {
      el.classList.add(status === "X" ? "local-board--won-x" : "local-board--won-o");
      stamp.innerHTML = markerSVG(status);
    } else if (status === "D") {
      el.classList.add("local-board--draw");
      stamp.innerHTML = '<span class="local-board__draw-mark" aria-hidden="true"></span>';
    }
  }

  function renderActiveBoards() {
    for (var b = 0; b < 9; b++) {
      var open = engine.boardStatus[b] === null;
      var isActive = !engine.globalStatus && open &&
        (engine.activeBoard === null || engine.activeBoard === b);
      localBoardEls[b].classList.toggle("local-board--active", isActive);
      localBoardEls[b].classList.toggle("local-board--disabled", !isActive && open);
    }
  }

  function renderTurn() {
    if (engine.globalStatus) {
      els.turnLabel.textContent = "Game over";
    } else {
      var name = engine.currentPlayer === "X" ? els.nameX.textContent : els.nameO.textContent;
      els.turnLabel.textContent = name + "\u2019s turn";
    }
    els.turnDot.className = "turn-dot turn-dot--" + engine.currentPlayer.toLowerCase();
  }

  function announce(text) {
    if (els.liveRegion) els.liveRegion.textContent = text;
  }

  function fullRender() {
    for (var b = 0; b < 9; b++) {
      for (var c = 0; c < 9; c++) renderCell(b, c);
      renderBoardStatus(b);
    }
    renderActiveBoards();
    renderTurn();
  }

  /* ---------- Responsive board sizing ----------
     Keeps the whole page inside one screen: the board is sized to the
     smaller of the available width/height inside .board-wrap, so it
     never pushes the page tall enough to need scrolling. ---------- */

  var BOARD_MIN_PX = 200;
  var BOARD_MAX_PX = 600;
  var fitBoardRaf = null;

  function fitBoard() {
    if (!boardWrapEl) return;
    var w = boardWrapEl.clientWidth;
    var h = boardWrapEl.clientHeight;
    if (!w || !h) return;
    var size = Math.max(BOARD_MIN_PX, Math.min(BOARD_MAX_PX, w, h));
    boardEl.style.width = size + "px";
  }

  function scheduleFitBoard() {
    if (fitBoardRaf) cancelAnimationFrame(fitBoardRaf);
    fitBoardRaf = requestAnimationFrame(function () {
      fitBoardRaf = null;
      fitBoard();
    });
  }

  if (boardWrapEl) {
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(scheduleFitBoard).observe(boardWrapEl);
    } else {
      window.addEventListener("resize", scheduleFitBoard);
      window.addEventListener("orientationchange", scheduleFitBoard);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleFitBoard);
    }
  }

  /* ---------- Interaction ---------- */

  function onCellClick(e) {
    if (engine.globalStatus) return;
    if (mode === "ai" && (aiThinking || engine.currentPlayer === "O")) return;
    var b = Number(e.currentTarget.dataset.board);
    var c = Number(e.currentTarget.dataset.cell);

    if (!engine.isLegalMove(b, c)) {
      window.TTTAnimation && window.TTTAnimation.shakeCell(cellEls[b][c]);
      if (!localBoardEls[b].classList.contains("local-board--active")) {
        window.TTTAnimation && window.TTTAnimation.shakeCell(localBoardEls[b]);
      }
      window.TTTSound && window.TTTSound.play("invalid");
      return;
    }
    commitMove(b, c);
  }

  function commitMove(b, c) {
    var result = engine.play(b, c);
    if (!result) return;

    renderCell(b, c);
    window.TTTAnimation && window.TTTAnimation.popCell(cellEls[b][c]);
    window.TTTSound && window.TTTSound.play("place");

    if (result.localWon || result.boardDrawn) {
      renderBoardStatus(b);
      if (result.localWon) {
        window.TTTAnimation && window.TTTAnimation.celebrateBoard(localBoardEls[b]);
        announce("Board " + (b + 1) + " won by " + result.boardWinner);
      } else {
        announce("Board " + (b + 1) + " is a draw");
      }
    }

    renderActiveBoards();
    renderTurn();

    if (result.globalWon) return endGame(result.player);
    if (result.globalDrawn) return endGame("D");

    announce(result.player + " played board " + (b + 1) + ", cell " + (c + 1) + ".");
    maybeTakeAiTurn();
  }

  function maybeTakeAiTurn() {
    if (mode !== "ai") return;
    if (engine.globalStatus) return;
    if (engine.currentPlayer !== "O") return;
    if (!window.TTTGame || !window.TTTGame.AI) return;

    aiThinking = true;
    if (els.aiThinkingEl) els.aiThinkingEl.hidden = false;
    if (boardWrapEl) boardWrapEl.classList.add("is-ai-turn");

    setTimeout(function () {
      var move = window.TTTGame.AI.pickMove(engine, "O", difficulty);

      aiThinking = false;
      if (els.aiThinkingEl) els.aiThinkingEl.hidden = true;
      if (boardWrapEl) boardWrapEl.classList.remove("is-ai-turn");

      if (move) commitMove(move.board, move.cell);
    }, 450);
  }

  function endGame(winner) {
    window.TTTStorage.recordResult(winner);
    refreshScoreboard();

    localBoardEls.forEach(function (el) { el.classList.remove("local-board--active"); });

    if (winner !== "D") {
      window.TTTAnimation && window.TTTAnimation.celebrateGlobalWin(boardEl, winner);
      window.TTTSound && window.TTTSound.play("win");
    } else {
      window.TTTSound && window.TTTSound.play("draw");
    }

    setTimeout(function () { showOverlay(winner); }, 500);
  }

  function showOverlay(winner) {
    els.overlay.hidden = false;
    requestAnimationFrame(function () { els.overlay.classList.add("victory-overlay--show"); });
    if (winner === "D") {
      els.overlayTitle.textContent = "It\u2019s a draw";
      els.overlaySub.textContent = "Nobody claimed the ultimate board. Try again?";
      els.overlayIcon.innerHTML = '<span class="draw-face" aria-hidden="true">\u2022 \u2022</span>';
    } else {
      var winnerName = winner === "X" ? els.nameX.textContent : els.nameO.textContent;
      els.overlayTitle.textContent = winnerName + " wins!";
      els.overlaySub.textContent = "Three boards in a row across the ultimate grid.";
      els.overlayIcon.innerHTML = markerSVG(winner);
    }
    announce(els.overlayTitle.textContent);
  }

  function hideOverlay() {
    els.overlay.classList.remove("victory-overlay--show");
    setTimeout(function () { els.overlay.hidden = true; }, 250);
  }

  function newGame() {
    hideOverlay();
    engine.reset();
    boardEl.classList.remove("ultimate-board--won");
    localBoardEls.forEach(function (el) {
      el.classList.remove("local-board--won-x", "local-board--won-o", "local-board--draw", "local-board--celebrate", "shake");
    });
    fullRender();
    fitBoard();
    window.TTTAnimation && window.TTTAnimation.boardEntrance(boardEl);
  }

  /* ---------- Controls ---------- */

  els.restartBtn.addEventListener("click", newGame);
  els.rematchBtn.addEventListener("click", newGame);
  els.menuBtn.addEventListener("click", function () { window.location.href = "../index.html"; });

  if (els.soundToggle) {
    var soundOn = window.TTTStorage.getSoundOn();
    els.soundToggle.setAttribute("aria-pressed", String(soundOn));
    els.soundToggle.classList.toggle("is-muted", !soundOn);
    els.soundToggle.addEventListener("click", function () {
      var next = !window.TTTStorage.getSoundOn();
      window.TTTStorage.setSoundOn(next);
      els.soundToggle.setAttribute("aria-pressed", String(next));
      els.soundToggle.classList.toggle("is-muted", !next);
      if (next) window.TTTSound && window.TTTSound.play("click");
    });
  }

  if (els.themeToggle) {
    var applyTheme = function (theme) {
      document.documentElement.setAttribute("data-theme", theme);
      els.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    };
    applyTheme(document.documentElement.getAttribute("data-theme") || "light");
    els.themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      window.TTTStorage.setTheme(next);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && els.overlay && !els.overlay.hidden) hideOverlay();
  });

  /* ---------- Init ---------- */

  fullRender();
  fitBoard();
  window.TTTAnimation && window.TTTAnimation.boardEntrance(boardEl);
  maybeTakeAiTurn();
})();
