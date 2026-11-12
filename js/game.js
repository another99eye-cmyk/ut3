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

  // AI mode: the human's symbol is chosen on the landing page's AI card and
  // is fixed for the whole match — there is no control to change it here.
  var humanSymbol = (params.get("symbol") || settings.playerSymbol || "X") === "O" ? "O" : "X";
  var aiSymbol = humanSymbol === "X" ? "O" : "X";

  // Two player mode: symbols are never chosen manually. Player 1's symbol
  // for *this* match comes from storage and automatically alternates after
  // every completed match (see endGame()).
  var p1Symbol = window.TTTStorage.getTwoPlayerStartSymbol();

  // Online mode: whoever created the room plays X and moves first; whoever
  // joined plays O. Set once the WebRTC connection opens.
  var onlineRole = params.get("role") === "guest" ? "guest" : "host";
  var onlineRoomCode = window.TTTOnline ? window.TTTOnline.normalizeCode(params.get("room")) : "";
  var mySymbol = onlineRole === "host" ? "X" : "O";
  var onlineRoom = null;
  var onlineConnected = false;

  // Scores for *this visit* to the game page only. It starts at zero every
  // time the page loads and keeps counting across Restart/Rematch. The
  // all-time totals shown on the home page live in TTTStorage and are still
  // updated by endGame() — the two are intentionally separate.
  var sessionStats = {
    twoPlayer: { p1Wins: 0, p2Wins: 0, draws: 0 },
    ai: { playerWins: 0, aiWins: 0, draws: 0 },
    online: { youWins: 0, opponentWins: 0, draws: 0 }
  };

  var engine = new GameEngine();
  var aiThinking = false;
  var aiTimeoutId = null;
  var paused = false;
  var history = [];   // snapshots, most-recent last
  var redoStack = []; // snapshots popped off history by undo(), most-recent last

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
    undoBtn: document.getElementById("undo-btn"),
    redoBtn: document.getElementById("redo-btn"),
    pauseBtn: document.getElementById("pause-btn"),
    bottomNav: document.getElementById("bottom-nav"),
    soundToggle: document.getElementById("sound-toggle"),
    themeToggle: document.querySelector(".theme-toggle"),
    overlay: document.getElementById("victory-overlay"),
    overlayIcon: document.getElementById("victory-icon"),
    overlayTitle: document.getElementById("victory-title"),
    overlaySub: document.getElementById("victory-sub"),
    rematchBtn: document.getElementById("rematch-btn"),
    mainMenuBtn: document.getElementById("main-menu-btn"),
    pauseOverlay: document.getElementById("pause-overlay"),
    resumeBtn: document.getElementById("resume-btn"),
    pauseRestartBtn: document.getElementById("pause-restart-btn"),
    pauseMenuBtn: document.getElementById("pause-menu-btn"),
    onlineOverlay: document.getElementById("online-overlay"),
    onlineTitle: document.getElementById("online-title"),
    onlineSub: document.getElementById("online-sub"),
    onlineRoomCodeWrap: document.getElementById("online-room-code"),
    onlineCodeText: document.getElementById("online-code-text"),
    copyLinkBtn: document.getElementById("copy-link-btn"),
    liveRegion: document.getElementById("live-region")
  };

  /* ---------- Header meta ---------- */

  var difficultyLabels = { easy: "Easy", medium: "Medium", hard: "Hard" };

  function updateModeLabels() {
    if (mode === "ai") {
      els.modeIndicator.textContent = "Vs AI";
      els.difficultyWrap.hidden = false;
      els.difficultyIndicator.textContent = difficultyLabels[difficulty] || "Medium";
      if (humanSymbol === "X") {
        els.nameX.textContent = "Player 1";
        els.nameO.textContent = "AI";
      } else {
        els.nameX.textContent = "AI";
        els.nameO.textContent = "Player 1";
      }
    } else if (mode === "online") {
      els.modeIndicator.textContent = "Online";
      els.difficultyWrap.hidden = true;
      if (mySymbol === "X") {
        els.nameX.textContent = "You";
        els.nameO.textContent = "Opponent";
      } else {
        els.nameX.textContent = "Opponent";
        els.nameO.textContent = "You";
      }
    } else {
      els.modeIndicator.textContent = "Two player";
      els.difficultyWrap.hidden = true;
      if (p1Symbol === "X") {
        els.nameX.textContent = "Player 1";
        els.nameO.textContent = "Player 2";
      } else {
        els.nameX.textContent = "Player 2";
        els.nameO.textContent = "Player 1";
      }
    }
  }
  updateModeLabels();

  function refreshScoreboard() {
    var stats = sessionStats;
    if (mode === "ai") {
      var humanScore = stats.ai.playerWins;
      var aiScore = stats.ai.aiWins;
      els.scoreX.textContent = humanSymbol === "X" ? humanScore : aiScore;
      els.scoreO.textContent = humanSymbol === "X" ? aiScore : humanScore;
      els.scoreDraw.textContent = stats.ai.draws;
    } else if (mode === "online") {
      var youScore = stats.online.youWins;
      var oppScore = stats.online.opponentWins;
      els.scoreX.textContent = mySymbol === "X" ? youScore : oppScore;
      els.scoreO.textContent = mySymbol === "X" ? oppScore : youScore;
      els.scoreDraw.textContent = stats.online.draws;
    } else {
      var p1 = stats.twoPlayer.p1Wins;
      var p2 = stats.twoPlayer.p2Wins;
      els.scoreX.textContent = p1Symbol === "X" ? p1 : p2;
      els.scoreO.textContent = p1Symbol === "X" ? p2 : p1;
      els.scoreDraw.textContent = stats.twoPlayer.draws;
    }
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
    } else if (mode === "ai") {
      els.turnLabel.textContent = engine.currentPlayer === aiSymbol
        ? "AI is thinking\u2026"
        : "Player\u2019s turn";
    } else if (mode === "online") {
      if (!onlineConnected) {
        els.turnLabel.textContent = "Waiting to connect\u2026";
      } else {
        els.turnLabel.textContent = engine.currentPlayer === mySymbol
          ? "Your turn"
          : "Opponent\u2019s turn";
      }
    } else {
      var isP1Turn = engine.currentPlayer === p1Symbol;
      els.turnLabel.textContent = (isP1Turn ? "Player 1" : "Player 2") + "\u2019s turn";
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
    if (paused) return;
    if (engine.globalStatus) return;
    if (mode === "ai" && (aiThinking || engine.currentPlayer === aiSymbol)) return;
    if (mode === "online" && (!onlineConnected || engine.currentPlayer !== mySymbol)) return;
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
    if (mode === "online" && onlineRoom) {
      onlineRoom.send({ type: "move", board: b, cell: c });
    }
  }

  function commitMove(b, c) {
    var result = engine.play(b, c);
    if (!result) return;

    pushHistory();
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

  /** Approximately 0.5–2s so the AI feels like it's actually considering
   *  the board, without ever feeling sluggish. */
  function aiThinkDelay() {
    return 600 + Math.random() * 700; // ~0.6s–1.3s
  }

  function maybeTakeAiTurn() {
    if (mode !== "ai") return;
    if (paused) return;
    if (engine.globalStatus) return;
    if (engine.currentPlayer !== aiSymbol) return;
    if (!window.TTTGame || !window.TTTGame.AI) return;

    aiThinking = true;
    renderTurn();
    if (boardWrapEl) boardWrapEl.classList.add("is-ai-turn");

    aiTimeoutId = setTimeout(function () {
      aiTimeoutId = null;
      var move = window.TTTGame.AI.pickMove(engine, aiSymbol, difficulty);

      aiThinking = false;
      if (boardWrapEl) boardWrapEl.classList.remove("is-ai-turn");

      if (move) commitMove(move.board, move.cell);
    }, aiThinkDelay());
  }

  /** Cancels a pending AI move (e.g. because the player paused or hit
   *  undo) so a stale move never lands after the state has changed. */
  function clearPendingAiTurn() {
    if (aiTimeoutId) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
    aiThinking = false;
    if (boardWrapEl) boardWrapEl.classList.remove("is-ai-turn");
  }

  /** Mirrors TTTStorage.recordResult(), but for the in-page session tally. */
  function recordSessionResult(bucket, outcome) {
    if (bucket === "ai") {
      if (outcome === "player") sessionStats.ai.playerWins++;
      else if (outcome === "ai") sessionStats.ai.aiWins++;
      else sessionStats.ai.draws++;
    } else if (bucket === "online") {
      if (outcome === "you") sessionStats.online.youWins++;
      else if (outcome === "opponent") sessionStats.online.opponentWins++;
      else sessionStats.online.draws++;
    } else {
      if (outcome === "p1") sessionStats.twoPlayer.p1Wins++;
      else if (outcome === "p2") sessionStats.twoPlayer.p2Wins++;
      else sessionStats.twoPlayer.draws++;
    }
  }

  function endGame(winner) {
    if (mode === "ai") {
      var aiOutcome = winner === "D" ? "draw" : (winner === humanSymbol ? "player" : "ai");
      window.TTTStorage.recordResult("ai", aiOutcome);
      recordSessionResult("ai", aiOutcome);
    } else if (mode === "online") {
      var onlineOutcome = winner === "D" ? "draw" : (winner === mySymbol ? "you" : "opponent");
      window.TTTStorage.recordResult("online", onlineOutcome);
      recordSessionResult("online", onlineOutcome);
    } else {
      var tpOutcome = winner === "D" ? "draw" : (winner === p1Symbol ? "p1" : "p2");
      window.TTTStorage.recordResult("twoPlayer", tpOutcome);
      recordSessionResult("twoPlayer", tpOutcome);
      // Symbols automatically swap for the *next* match — takes effect the
      // next time newGame() reads the start symbol from storage.
      window.TTTStorage.toggleTwoPlayerStartSymbol();
    }
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
    clearPendingAiTurn();
    hideOverlay();
    if (mode === "two-player") {
      // Re-read in case the previous match just finished and toggled it.
      p1Symbol = window.TTTStorage.getTwoPlayerStartSymbol();
    }
    engine.reset();
    boardEl.classList.remove("ultimate-board--won");
    localBoardEls.forEach(function (el) {
      el.classList.remove("local-board--won-x", "local-board--won-o", "local-board--draw", "local-board--celebrate", "shake");
    });
    history = [];
    redoStack = [];
    pushHistory();
    updateModeLabels();
    refreshScoreboard();
    fullRender();
    fitBoard();
    window.TTTAnimation && window.TTTAnimation.boardEntrance(boardEl);
    maybeTakeAiTurn();
  }

  /** Restart button/menu handlers call this. In online mode it also tells
   *  the other player to restart, so both boards reset together. */
  function restartGame(broadcast) {
    newGame();
    if (mode === "online" && broadcast && onlineRoom) {
      onlineRoom.send({ type: "restart" });
    }
  }

  /* ---------- Undo / redo ----------
     A snapshot is taken after every committed move. In AI mode a human
     move and the AI's reply are treated as one atomic step, so undo/redo
     always leave the human to move next. ---------- */

  function snapshotEngine() {
    return {
      boards: engine.boards.map(function (row) { return row.slice(); }),
      boardStatus: engine.boardStatus.slice(),
      boardWinLines: engine.boardWinLines.map(function (l) { return l ? l.slice() : null; }),
      currentPlayer: engine.currentPlayer,
      activeBoard: engine.activeBoard,
      globalStatus: engine.globalStatus,
      globalWinLine: engine.globalWinLine ? engine.globalWinLine.slice() : null,
      moveCount: engine.moveCount,
      lastMove: engine.lastMove,
      mover: engine.lastMove ? engine.lastMove.player : null
    };
  }

  function restoreEngine(snap) {
    engine.boards = snap.boards.map(function (row) { return row.slice(); });
    engine.boardStatus = snap.boardStatus.slice();
    engine.boardWinLines = snap.boardWinLines.map(function (l) { return l ? l.slice() : null; });
    engine.currentPlayer = snap.currentPlayer;
    engine.activeBoard = snap.activeBoard;
    engine.globalStatus = snap.globalStatus;
    engine.globalWinLine = snap.globalWinLine ? snap.globalWinLine.slice() : null;
    engine.moveCount = snap.moveCount;
    engine.lastMove = snap.lastMove;
  }

  function pushHistory() {
    history.push(snapshotEngine());
    redoStack = [];
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (mode === "online") {
      // Undo/redo would desync the two peers' boards, so they're simply
      // unavailable in online matches.
      if (els.undoBtn) els.undoBtn.disabled = true;
      if (els.redoBtn) els.redoBtn.disabled = true;
      return;
    }
    if (els.undoBtn) els.undoBtn.disabled = history.length <= 1;
    if (els.redoBtn) els.redoBtn.disabled = redoStack.length === 0;
  }

  function afterHistoryChange() {
    fullRender();
    if (engine.globalStatus) {
      showOverlay(engine.globalStatus);
    } else {
      hideOverlay();
    }
    updateHistoryButtons();
    maybeTakeAiTurn();
  }

  function undo() {
    if (mode === "online" || paused) return;
    if (history.length <= 1) return;
    clearPendingAiTurn();

    var popped = history.pop();
    redoStack.push(popped);

    if (mode === "ai" && popped.mover === aiSymbol && history.length > 1) {
      redoStack.push(history.pop());
    }

    restoreEngine(history[history.length - 1]);
    afterHistoryChange();
  }

  function redo() {
    if (mode === "online" || paused) return;
    if (!redoStack.length) return;
    clearPendingAiTurn();

    var next = redoStack.pop();
    history.push(next);

    if (mode === "ai" && next.mover === humanSymbol && redoStack.length &&
        redoStack[redoStack.length - 1].mover === aiSymbol) {
      history.push(redoStack.pop());
    }

    restoreEngine(history[history.length - 1]);
    afterHistoryChange();
  }

  /* ---------- Pause ---------- */

  function showPauseOverlay() {
    if (!els.pauseOverlay) return;
    els.pauseOverlay.hidden = false;
    requestAnimationFrame(function () { els.pauseOverlay.classList.add("victory-overlay--show"); });
  }

  function hidePauseOverlay() {
    if (!els.pauseOverlay) return;
    els.pauseOverlay.classList.remove("victory-overlay--show");
    setTimeout(function () { els.pauseOverlay.hidden = true; }, 250);
  }

  function pauseGame() {
    if (paused || engine.globalStatus) return;
    paused = true;
    clearPendingAiTurn();
    if (els.bottomNav) els.bottomNav.classList.add("bottom-nav--disabled");
    showPauseOverlay();
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    hidePauseOverlay();
    if (els.bottomNav) els.bottomNav.classList.remove("bottom-nav--disabled");
    maybeTakeAiTurn();
  }

  /* ---------- Online (WebRTC via PeerJS) ----------
     One data channel, two message types: "move" (board, cell) and
     "restart". Each side runs the exact same rules engine locally, so
     there's nothing to reconcile — whatever arrives just gets replayed
     through the normal commitMove()/newGame() paths. ---------- */

  function showOnlineOverlay(title, sub, code) {
    if (!els.onlineOverlay) return;
    els.onlineTitle.textContent = title;
    els.onlineSub.textContent = sub;
    if (code) {
      els.onlineRoomCodeWrap.hidden = false;
      els.onlineCodeText.textContent = code;
    } else {
      els.onlineRoomCodeWrap.hidden = true;
    }
    els.onlineOverlay.hidden = false;
    requestAnimationFrame(function () { els.onlineOverlay.classList.add("victory-overlay--show"); });
  }

  function hideOnlineOverlay() {
    if (!els.onlineOverlay) return;
    els.onlineOverlay.classList.remove("victory-overlay--show");
    setTimeout(function () { els.onlineOverlay.hidden = true; }, 250);
  }

  function buildInviteLink(code) {
    var url = new URL(window.location.href);
    url.searchParams.set("mode", "online");
    url.searchParams.set("role", "guest");
    url.searchParams.set("room", code);
    return url.toString();
  }

  function initOnline() {
    if (!window.TTTOnline) {
      showOnlineOverlay("Can\u2019t connect", "Something didn\u2019t load correctly. Try reloading the page.", null);
      return;
    }
    if (!onlineRoomCode) {
      showOnlineOverlay("No room code", "That link is missing a room code. Head back and create or join a room.", null);
      return;
    }

    if (els.copyLinkBtn) {
      els.copyLinkBtn.addEventListener("click", function () {
        var link = buildInviteLink(onlineRoomCode);
        var done = function () {
          var original = els.copyLinkBtn.textContent;
          els.copyLinkBtn.textContent = "Copied!";
          setTimeout(function () { els.copyLinkBtn.textContent = original; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done, done);
        } else {
          window.prompt("Copy this link:", link);
        }
      });
    }

    onlineRoom = window.TTTOnline.createRoom({
      onHosted: function (code) {
        showOnlineOverlay("Room ready", "Share this code or link with a friend to start.", code);
      },
      onConnected: function () {
        onlineConnected = true;
        hideOnlineOverlay();
        renderTurn();
      },
      onMessage: function (data) {
        if (!data || typeof data !== "object") return;
        if (data.type === "move") {
          commitMove(data.board, data.cell);
        } else if (data.type === "restart") {
          restartGame(false);
        }
      },
      onDisconnected: function () {
        onlineConnected = false;
        renderTurn();
        showOnlineOverlay("Opponent disconnected", "They'll need a fresh invite link to rejoin.", null);
      },
      onError: function (message) {
        showOnlineOverlay("Connection problem", message, null);
      }
    });

    if (onlineRole === "host") {
      showOnlineOverlay("Setting up your room\u2026", "This only takes a second.", null);
      onlineRoom.host(onlineRoomCode);
    } else {
      showOnlineOverlay("Joining room " + onlineRoomCode + "\u2026", "Connecting to your friend.", null);
      onlineRoom.join(onlineRoomCode);
    }
  }

  /* ---------- Controls ---------- */

  els.restartBtn.addEventListener("click", function () { restartGame(true); });
  els.rematchBtn.addEventListener("click", function () { restartGame(true); });

  if (els.undoBtn) els.undoBtn.addEventListener("click", undo);
  if (els.redoBtn) els.redoBtn.addEventListener("click", redo);

  if (els.pauseBtn) els.pauseBtn.addEventListener("click", pauseGame);
  if (els.resumeBtn) els.resumeBtn.addEventListener("click", resumeGame);
  if (els.pauseRestartBtn) {
    els.pauseRestartBtn.addEventListener("click", function () {
      paused = false;
      hidePauseOverlay();
      if (els.bottomNav) els.bottomNav.classList.remove("bottom-nav--disabled");
      restartGame(true);
    });
  }
  // els.pauseMenuBtn is a plain link to ../index.html — completed-match
  // stats are already persisted via recordResult(), nothing else to save.

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
    if (e.key !== "Escape") return;
    if (paused) resumeGame();
    else if (els.overlay && !els.overlay.hidden) hideOverlay();
  });

  window.addEventListener("beforeunload", function () {
    if (onlineRoom) onlineRoom.close();
  });

  /* ---------- Init ---------- */

  pushHistory();
  fullRender();
  fitBoard();
  window.TTTAnimation && window.TTTAnimation.boardEntrance(boardEl);

  if (mode === "online") {
    initOnline();
  } else {
    maybeTakeAiTurn();
  }
})();