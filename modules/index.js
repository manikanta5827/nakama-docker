function rpcHealthCheck(ctx, logger, nk, payload) {
  logger.info("Health check RPC called!");
  return JSON.stringify({
    success: true,
    message: "Nakama server is alive!",
    timestamp: Date.now()
  });
}

function rpcSaveStats(ctx, logger, nk, payload) {
  var userId = ctx.userId;
  var stats = {
    wins: 0,
    losses: 0,
    draws: 0
  };
  var writeRequest = {
    collection: "player_stats",
    key: "stats",
    userId: userId,
    value: stats,
    permissionRead: 1,
    permissionWrite: 0
  };
  try {
    nk.storageWrite([writeRequest]);
    logger.info("Stats saved for user: %s", userId);
  } catch (error) {
    logger.error("Failed to save stats: %s", error.message);
    throw error;
  }
  return JSON.stringify({
    success: true,
    saved: stats
  });
}
function rpcGetStats(ctx, logger, nk, payload) {
  var userId = ctx.userId;
  var readRequest = {
    collection: "player_stats",
    key: "stats",
    userId: userId
  };
  try {
    var result = nk.storageRead([readRequest]);
    if (result.length === 0) {
      return JSON.stringify({
        wins: 0,
        losses: 0,
        draws: 0
      });
    }
    return JSON.stringify(result[0].value);
  } catch (error) {
    logger.error("Failed to get stats: %s", error.message);
    throw error;
  }
}

function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e,
      n,
      i,
      u,
      a = [],
      f = true,
      o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
    } catch (r) {
      o = true, n = r;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}

var OPCODE_MOVE = 1;
var OPCODE_GAME_STATE = 2;
var OPCODE_GAME_OVER = 3;
var OPCODE_START = 4;
var OPCODE_DRAW = 5;
var OPCODE_PARTNER_LEFT = 6;
var OPCODE_SERVER_SHUTDOWN = 7;
var MODULE_NAME = "tictactoe";

function matchInit(ctx, logger, nk, params) {
  logger.info("Match created — setting up board");
  var state = {
    board: Array(9).fill(null),
    players: {},
    playerSymbols: {},
    currentTurn: null,
    gameOver: false,
    winner: null
  };
  return {
    state: state,
    tickRate: 1,
    label: "tictactoe"
  };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var playerCount = Object.keys(state.players).length;
  if (playerCount >= 2) {
    return {
      state: state,
      accept: false,
      rejectMessage: "Match is full — only 2 players allowed"
    };
  }
  logger.info("Player attempting to join: %s", presence.userId);
  return {
    state: state,
    accept: true
  };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function (presence) {
    state.players[presence.userId] = presence;
    var playerCount = Object.keys(state.players).length;
    state.playerSymbols[presence.userId] = playerCount === 1 ? "X" : "O";
    logger.info("Player joined: %s as %s", presence.userId, state.playerSymbols[presence.userId]);
  });
  var playerCount = Object.keys(state.players).length;
  if (playerCount === 2) {
    var playerIds = Object.keys(state.players);
    state.currentTurn = playerIds[0];
    logger.info("Both players joined — game starting!");
    dispatcher.broadcastMessage(OPCODE_START, JSON.stringify({
      board: state.board,
      playerSymbols: state.playerSymbols,
      currentTurn: state.currentTurn
    }), null, null);
  }
  return {
    state: state
  };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  if (state.gameOver) {
    logger.info("Game over — ending match");
    return null;
  }
  messages.forEach(function (message) {
    var senderId = message.sender.userId;
    if (message.opCode !== OPCODE_MOVE) return;
    var data = JSON.parse(nk.binaryToString(message.data));
    var position = data.position;
    logger.info("Move received from %s at position %d", senderId, position);
    if (state.currentTurn !== senderId) {
      logger.warn("Not this player's turn: %s", senderId);
      return;
    }
    if (position < 0 || position > 8) {
      logger.warn("Invalid position: %d", position);
      return;
    }
    if (state.board[position] !== null) {
      logger.warn("Cell already taken: %d", position);
      return;
    }
    var symbol = state.playerSymbols[senderId];
    state.board[position] = symbol;
    var winner = checkWinner(state.board);
    if (winner) {
      state.gameOver = true;
      state.winner = senderId;
      dispatcher.broadcastMessage(OPCODE_GAME_OVER, JSON.stringify({
        board: state.board,
        winner: senderId,
        winnerSymbol: symbol,
        draw: false
      }), null, null);
      return;
    }
    var isDraw = state.board.every(function (cell) {
      return cell !== null;
    });
    if (isDraw) {
      state.gameOver = true;
      dispatcher.broadcastMessage(OPCODE_DRAW, JSON.stringify({
        board: state.board,
        winner: null,
        draw: true
      }), null, null);
      return;
    }
    var playerIds = Object.keys(state.players);
    state.currentTurn = playerIds.find(function (id) {
      return id !== senderId;
    }) || null;
    dispatcher.broadcastMessage(OPCODE_GAME_STATE, JSON.stringify({
      board: state.board,
      currentTurn: state.currentTurn,
      lastMove: {
        position: position,
        symbol: symbol,
        playerId: senderId
      }
    }), null, null);
  });
  return {
    state: state
  };
}
function checkWinner(board) {
  var lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (var i = 0; i < lines.length; i++) {
    var _lines$i = _slicedToArray(lines[i], 3),
      a = _lines$i[0],
      b = _lines$i[1],
      c = _lines$i[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function (presence) {
    delete state.players[presence.userId];
    logger.info("Player left: %s", presence.userId);
  });
  if (Object.keys(state.players).length < 2 && !state.gameOver) {
    logger.info("Player disconnected — ending match");
    dispatcher.broadcastMessage(OPCODE_PARTNER_LEFT, JSON.stringify({
      reason: "partner_left"
    }), null, null);
    return null;
  }
  return {
    state: state
  };
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  logger.info("Match terminating — grace period: %d seconds", graceSeconds);
  dispatcher.broadcastMessage(OPCODE_SERVER_SHUTDOWN, JSON.stringify({
    reason: "Server shutting down"
  }), null, null);
  return {
    state: state
  };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return {
    state: state,
    data: data
  };
}
function rpcCreateMatch(ctx, logger, nk, payload) {
  var matchId = nk.matchCreate(MODULE_NAME, {});
  logger.info("Match created with ID: %s", matchId);
  return JSON.stringify({
    matchId: matchId
  });
}

function InitModule(ctx, logger, nk, initializer) {
  try {
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }
  try {
    initializer.registerRpc("save_stats", rpcSaveStats);
    initializer.registerRpc("get_stats", rpcGetStats);
    logger.info("storage RPCs registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }
  try {
    initializer.registerMatch(MODULE_NAME, {
      matchInit: matchInit,
      matchJoinAttempt: matchJoinAttempt,
      matchJoin: matchJoin,
      matchLoop: matchLoop,
      matchLeave: matchLeave,
      matchTerminate: matchTerminate,
      matchSignal: matchSignal
    });
    initializer.registerRpc("create_match", rpcCreateMatch);
    logger.info("match handler registered");
  } catch (error) {
    logger.error("Failed: %s", error.message);
  }
  logger.info("=== Game server loaded successfully ===");
}
!InitModule && InitModule.bind(null);
