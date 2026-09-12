/* ==========================================================================
   online.js — WebRTC (via PeerJS) room connection for two-player online play

   PeerJS's free public broker (peerjs.com) is only used to help two browsers
   find each other; once connected, moves travel directly between the two
   players over a WebRTC data channel — no game server involved.

   Exposes window.TTTOnline:
     randomRoomCode()      -> short human-shareable code, e.g. "K3F9Q"
     createRoom(handlers)  -> Room instance; call .host(code) or .join(code)

   Room handlers (all optional):
     onHosted(code)     — room is live and discoverable under `code`
     onConnected()      — the data channel to the other player is open
     onMessage(data)    — a message object arrived from the other player
     onDisconnected()   — the other player's connection closed
     onError(message)   — something went wrong; `message` is human-readable
   ========================================================================== */

window.TTTOnline = (function () {
  "use strict";

  // Namespaced so our room codes don't collide with unrelated apps sharing
  // PeerJS's public broker. Excludes visually ambiguous characters
  // (0/O, 1/I/L) since people have to read and retype these by hand.
  var ROOM_PREFIX = "xt3uttt-";
  var CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function randomRoomCode(len) {
    len = len || 5;
    var out = "";
    for (var i = 0; i < len; i++) {
      out += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return out;
  }

  function normalizeCode(code) {
    return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function friendlyPeerError(err) {
    var type = err && err.type;
    if (type === "peer-unavailable") return "Room not found. Check the code and try again.";
    if (type === "unavailable-id") return "That room code is already taken. Try again for a new one.";
    if (type === "network" || type === "disconnected" || type === "server-error") {
      return "Couldn't reach the connection service. Check your internet and try again.";
    }
    return "Something went wrong connecting. Please try again.";
  }

  function Room(handlers) {
    this.handlers = handlers || {};
    this.peer = null;
    this.conn = null;
    this.role = null; // "host" | "guest"
    this.code = null;
  }

  Room.prototype._emit = function (name) {
    var fn = this.handlers[name];
    if (typeof fn !== "function") return;
    var args = Array.prototype.slice.call(arguments, 1);
    fn.apply(null, args);
  };

  Room.prototype._wireConnection = function (conn) {
    var self = this;
    this.conn = conn;
    conn.on("open", function () { self._emit("onConnected"); });
    conn.on("data", function (data) { self._emit("onMessage", data); });
    conn.on("close", function () { self._emit("onDisconnected"); });
    conn.on("error", function (err) { self._emit("onError", friendlyPeerError(err)); });
  };

  /** Become discoverable under `code` (or a fresh random one) and wait for
   *  a single guest to connect. */
  Room.prototype.host = function (code) {
    if (typeof Peer !== "function") {
      this._emit("onError", "Couldn't load the connection library. Check your internet and reload.");
      return;
    }
    var self = this;
    this.role = "host";
    this.code = normalizeCode(code) || randomRoomCode();
    this.peer = new Peer(ROOM_PREFIX + this.code);

    this.peer.on("open", function () { self._emit("onHosted", self.code); });
    this.peer.on("connection", function (conn) {
      if (self.conn) { conn.close(); return; } // only one guest per room
      self._wireConnection(conn);
    });
    this.peer.on("error", function (err) { self._emit("onError", friendlyPeerError(err)); });
  };

  /** Connect out to an existing room. */
  Room.prototype.join = function (code) {
    if (typeof Peer !== "function") {
      this._emit("onError", "Couldn't load the connection library. Check your internet and reload.");
      return;
    }
    var self = this;
    this.role = "guest";
    this.code = normalizeCode(code);
    this.peer = new Peer();

    this.peer.on("open", function () {
      var conn = self.peer.connect(ROOM_PREFIX + self.code, { reliable: true });
      self._wireConnection(conn);
    });
    this.peer.on("error", function (err) { self._emit("onError", friendlyPeerError(err)); });
  };

  Room.prototype.send = function (message) {
    if (this.conn && this.conn.open) this.conn.send(message);
  };

  Room.prototype.close = function () {
    if (this.conn) { try { this.conn.close(); } catch (e) { /* already gone */ } }
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* already gone */ } }
    this.conn = null;
    this.peer = null;
  };

  return {
    randomRoomCode: randomRoomCode,
    normalizeCode: normalizeCode,
    createRoom: function (handlers) { return new Room(handlers); }
  };
})();
