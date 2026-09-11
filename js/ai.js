/* ==========================================================================
   ai.js — Ultimate Tic-Tac-Toe computer opponent
   Exposes window.TTTGame.AI.pickMove(engine, player, difficulty)

   Three difficulty levels, all built on top of window.TTTGame.Engine
   (see game.js) so the AI always follows the same legal-move rules as a
   human player:

     easy   — mostly random, occasionally takes an obvious local win/block
     medium — heuristic scoring: local wins/blocks, center/corner
              preference, and where the move sends the opponent next
     hard   — minimax + alpha-beta pruning, iterative deepening within a
              time budget so the browser stays responsive
   ========================================================================== */

window.TTTGame = window.TTTGame || {};

(function () {
  "use strict";

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  var CENTER_CELL = 4;
  var CORNER_CELLS = [0, 2, 6, 8];

  function otherPlayer(player) {
    return player === "X" ? "O" : "X";
  }

  function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function cellPositionValue(cell) {
    if (cell === CENTER_CELL) return 3;
    if (CORNER_CELLS.indexOf(cell) !== -1) return 2;
    return 1;
  }

  function countMarks(cells, player) {
    var n = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i] === player) n++;
    return n;
  }

  /** Would `player` win this local board (given as a flat 9-cell array)
   *  by playing at `cell`? Pure/non-mutating. */
  function wouldWinLocal(cells, cell, player) {
    var copy = cells.slice();
    copy[cell] = player;
    var result = window.TTTGame.checkLineWinner(copy);
    return !!(result && result.winner === player);
  }

  function findLocalWinningMove(engine, moves, player) {
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (wouldWinLocal(engine.boards[m.board], m.cell, player)) return m;
    }
    return null;
  }

  /* ========================================================================
     EASY — mostly random legal moves, occasionally wins or blocks.
     ======================================================================== */

  function pickEasyMove(engine, player) {
    var moves = engine.legalMoves();
    if (!moves.length) return null;
    var opponent = otherPlayer(player);

    if (Math.random() < 0.35) {
      var winMove = findLocalWinningMove(engine, moves, player);
      if (winMove) return winMove;
    }
    if (Math.random() < 0.25) {
      var blockMove = findLocalWinningMove(engine, moves, opponent);
      if (blockMove) return blockMove;
    }
    return randomChoice(moves);
  }

  /* ========================================================================
     MEDIUM — heuristic-scored move: local wins/blocks, center/corner
     preference, and which board the move sends the opponent to.
     ======================================================================== */

  function scoreMediumMove(engine, move, player, opponent) {
    var score = Math.random() * 0.5; // tiny jitter so ties don't always pick the same move
    var localCells = engine.boards[move.board];

    if (wouldWinLocal(localCells, move.cell, player)) score += 100;
    if (wouldWinLocal(localCells, move.cell, opponent)) score += 55; // denies the opponent that cell

    score += cellPositionValue(move.cell) * 2;  // center/corner within the local board
    score += cellPositionValue(move.board) * 4; // center/corner on the meta grid

    var destBoard = move.cell;
    if (engine.boardStatus[destBoard] === null) {
      var oppMarks = countMarks(engine.boards[destBoard], opponent);
      var selfMarks = countMarks(engine.boards[destBoard], player);
      score -= oppMarks * 6;
      score += selfMarks * 2;
    } else {
      score -= 12; // sends the opponent to "any open board" — a free, dangerous choice
    }

    return score;
  }

  function pickMediumMove(engine, player) {
    var moves = engine.legalMoves();
    if (!moves.length) return null;
    var opponent = otherPlayer(player);

    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var score = scoreMediumMove(engine, moves[i], player, opponent);
      if (score > bestScore) {
        bestScore = score;
        best = moves[i];
      }
    }
    return best;
  }

  /* ========================================================================
     HARD — minimax with alpha-beta pruning, iterative deepening within a
     time budget. Evaluation weighs the meta-grid (boardStatus) the same
     way a normal tic-tac-toe board would be scored, plus a lighter-weight
     look at marks within still-open local boards.
     ======================================================================== */

  function lineIsLive(vals, player) {
    for (var i = 0; i < 3; i++) {
      var v = vals[i];
      if (v && v !== player) return false; // blocked by a draw or the opponent
    }
    return true;
  }

  function countInLine(vals, player) {
    var n = 0;
    for (var i = 0; i < 3; i++) if (vals[i] === player) n++;
    return n;
  }

  function scoreMetaGrid(boardStatus, player, opponent) {
    var score = 0;
    for (var i = 0; i < LINES.length; i++) {
      var idx = LINES[i];
      var vals = [boardStatus[idx[0]], boardStatus[idx[1]], boardStatus[idx[2]]];

      if (lineIsLive(vals, player)) {
        var mine = countInLine(vals, player);
        if (mine === 2) score += 90;
        else if (mine === 1) score += 10;
      }
      if (lineIsLive(vals, opponent)) {
        var theirs = countInLine(vals, opponent);
        if (theirs === 2) score -= 90;
        else if (theirs === 1) score -= 10;
      }
    }
    for (var b = 0; b < 9; b++) {
      if (boardStatus[b] === player) score += cellPositionValue(b) * 5;
      else if (boardStatus[b] === opponent) score -= cellPositionValue(b) * 5;
    }
    return score;
  }

  function scoreOpenLocalBoards(engine, player, opponent) {
    var score = 0;
    for (var b = 0; b < 9; b++) {
      if (engine.boardStatus[b] !== null) continue;
      var cells = engine.boards[b];
      for (var i = 0; i < LINES.length; i++) {
        var idx = LINES[i];
        var vals = [cells[idx[0]], cells[idx[1]], cells[idx[2]]];

        if (lineIsLive(vals, player)) {
          var mine = countInLine(vals, player);
          if (mine === 2) score += 6;
          else if (mine === 1) score += 1;
        }
        if (lineIsLive(vals, opponent)) {
          var theirs = countInLine(vals, opponent);
          if (theirs === 2) score -= 6;
          else if (theirs === 1) score -= 1;
        }
      }
    }
    return score;
  }

  function evaluate(engine, aiPlayer) {
    var opponent = otherPlayer(aiPlayer);
    if (engine.globalStatus === aiPlayer) return 1000000;
    if (engine.globalStatus === opponent) return -1000000;
    if (engine.globalStatus === "D") return 0;

    var score = 0;
    score += scoreMetaGrid(engine.boardStatus, aiPlayer, opponent) * 10;
    score += scoreOpenLocalBoards(engine, aiPlayer, opponent);
    score += engine.activeBoard === null ? 4 : -2; // freedom of choice is generally good
    return score;
  }

  function orderedMoves(engine, moves, player, opponent) {
    return moves
      .slice()
      .sort(function (a, b) {
        return scoreMediumMove(engine, b, player, opponent) - scoreMediumMove(engine, a, player, opponent);
      });
  }

  /** Negamax with alpha-beta pruning. `sign` is +1 if it's aiPlayer's turn
   *  to move in this node, -1 if it's the opponent's turn. */
  function negamax(engine, depth, alpha, beta, aiPlayer, sign, deadline) {
    if (engine.globalStatus || depth === 0 || Date.now() > deadline) {
      return sign * evaluate(engine, aiPlayer);
    }

    var toMove = sign === 1 ? aiPlayer : otherPlayer(aiPlayer);
    var moves = engine.legalMoves();
    if (!moves.length) return sign * evaluate(engine, aiPlayer);

    var candidates = orderedMoves(engine, moves, toMove, otherPlayer(toMove));
    var best = -Infinity;

    for (var i = 0; i < candidates.length; i++) {
      var child = engine.clone();
      child.play(candidates[i].board, candidates[i].cell);
      var val = -negamax(child, depth - 1, -beta, -alpha, aiPlayer, -sign, deadline);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break; // beta cutoff
      if (Date.now() > deadline) break;
    }
    return best;
  }

  function pickHardMove(engine, player) {
    var moves = engine.legalMoves();
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];

    var opponent = otherPlayer(player);
    var deadline = Date.now() + 450; // keeps the UI thread responsive
    var maxDepth = 5;
    var bestMove = orderedMoves(engine, moves, player, opponent)[0];

    for (var depth = 1; depth <= maxDepth; depth++) {
      if (Date.now() > deadline) break;

      var candidates = orderedMoves(engine, moves, player, opponent);
      var alpha = -Infinity;
      var beta = Infinity;
      var depthBest = candidates[0];
      var depthBestScore = -Infinity;

      for (var i = 0; i < candidates.length; i++) {
        var child = engine.clone();
        child.play(candidates[i].board, candidates[i].cell);
        var val = -negamax(child, depth - 1, -beta, -alpha, player, -1, deadline);
        if (val > depthBestScore) {
          depthBestScore = val;
          depthBest = candidates[i];
        }
        if (val > alpha) alpha = val;
        if (Date.now() > deadline) break;
      }

      bestMove = depthBest;
      if (Date.now() > deadline) break;
    }

    return bestMove;
  }

  /* ========================================================================
     Public entry point
     ======================================================================== */

  function pickMove(engine, player, difficulty) {
    if (difficulty === "hard") return pickHardMove(engine, player);
    if (difficulty === "easy") return pickEasyMove(engine, player);
    return pickMediumMove(engine, player); // default
  }

  window.TTTGame.AI = { pickMove: pickMove };
})();
