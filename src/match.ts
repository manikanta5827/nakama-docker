import {
  OPCODE_MOVE,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_START,
  MODULE_NAME,
  OPCODE_DRAW,
  OPCODE_SERVER_SHUTDOWN,
  OPCODE_PARTNER_LEFT,
  REASON_NORMAL,
  REASON_PARTNER_LEFT,
} from './constants';

// =====================
// saveMatchResult
// Called at end of every match — writes to permanent Nakama Storage
// Stores TWO separate keys per player:
//   1. "summary"       — running totals { wins, losses, draws }
//   2. "match_<id>"    — one row per match { result, reason, opponent, timestamp }
// =====================
function saveMatchResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  player1Id: string,
  player2Id: string,
  player1Result: string,  // "win" | "loss" | "draw"
  player2Result: string,
  reason: string,         // "normal" | "partner_left" | "timeout" | ""
  matchId: string
): void {

  logger.info("Saving match result for players %s and %s — result: %s vs %s reason: %s", player1Id, player2Id, player1Result, player2Result, reason);
  const timestamp = Date.now();

  const writeForPlayer = (
    userId: string,
    opponentId: string,
    result: string
  ) => {

    // ── Step 1: Read existing summary ──
    let summary = { wins: 0, losses: 0, draws: 0 };

    try {
      const existing = nk.storageRead([{
        collection: "stats",
        key: "summary",
        userId: userId
      }]);

      if (existing && existing.length > 0) {
        const rawValue = existing[0].value;
        if (typeof rawValue === "string") {
          summary = JSON.parse(rawValue);
        } else if (rawValue && typeof rawValue === "object") {
          summary = rawValue as { wins: number; losses: number; draws: number };
        }
      }
    } catch (e) {
      logger.warn("No summary yet for %s — starting fresh", userId);
    }

    // ── Step 2: Update summary totals ──
    if (result === "win") summary.wins += 1;
    if (result === "loss") summary.losses += 1;
    if (result === "draw") summary.draws += 1;

    // ── Step 3: Write summary + per-match row in ONE call ──
    nk.storageWrite([
      {
        // Summary row — always just 3 numbers, fast to read
        collection: "stats",
        key: "summary",
        userId: userId,
        value: summary,
        permissionRead: 1,
        permissionWrite: 0
      },
      {
        // Per-match row — one row per match, keyed by matchId
        // reason is only for win/loss — empty string for draw
        collection: "stats",
        key: "match_" + matchId,
        userId: userId,
        value: {
          result,               // "win" | "loss" | "draw"
          reason,               // "normal" | "partner_left" | "" (draw has no reason)
          opponent: opponentId,
          timestamp
        },
        permissionRead: 1,
        permissionWrite: 0
      }
    ]);

    logger.info(
      "Stats saved for %s — result: %s reason: %s",
      userId, result, reason
    );
  };

  writeForPlayer(player1Id, player2Id, player1Result);
  writeForPlayer(player2Id, player1Id, player2Result);
}

// =====================
// matchInit
// Called ONCE when match is created
// Like a constructor — set up your initial state
// =====================
export function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState, tickRate: number, label: string } {

  logger.info("Match created — setting up board");

  const state: nkruntime.MatchState = {
    board: Array(9).fill(null),  // 9 empty cells
    players: {},                  // no players yet
    playerSymbols: {},            // no symbols assigned yet
    currentTurn: null,            // nobody's turn yet
    gameOver: false,
    winner: null
  };

  return {
    state,
    tickRate: 0.5,    // matchLoop runs 1 time per second (enough for Tic-Tac-Toe)
    label: "tictactoe"
  };
}

// =====================
// matchJoinAttempt
// Called when a player TRIES to join — before they actually join
// This is your bouncer — return accept: false to reject them
// =====================
export function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState, accept: boolean, rejectMessage?: string } | null {

  // Only allow 2 players max
  const playerCount = Object.keys(state.players).length;

  if (playerCount >= 2) {
    return {
      state,
      accept: false,
      rejectMessage: "Match is full — only 2 players allowed"
    };
  }

  logger.info("Player attempting to join: %s", presence.userId);
  return { state, accept: true };
}

// =====================
// matchJoin
// Called AFTER player successfully joins
// This is where you add them to state and assign X or O
// =====================
export function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {

  presences.forEach(function (presence) {
    // Add player to state
    state.players[presence.userId] = presence;

    // First player gets X, second gets O
    const playerCount = Object.keys(state.players).length;
    state.playerSymbols[presence.userId] = playerCount === 1 ? "X" : "O";

    logger.info(
      "Player joined: %s as %s",
      presence.userId,
      state.playerSymbols[presence.userId]
    );
  });

  // If 2 players are now in — start the game!
  const playerCount = Object.keys(state.players).length;
  if (playerCount === 2) {
    // First player (X) goes first
    const playerIds = Object.keys(state.players);
    state.currentTurn = playerIds[0]; // X always goes first

    logger.info("Both players joined — game starting!");

    // Tell both players the game is starting
    // broadcastMessage(opcode, data, presences=null means everyone)
    dispatcher.broadcastMessage(
      OPCODE_START,
      JSON.stringify({
        board: state.board,
        playerSymbols: state.playerSymbols,
        currentTurn: state.currentTurn
      }),
      null,  // null = send to ALL players in match
      null
    );
  }

  return { state };
}

// =====================
// matchLoop
// Called every tick (every 1 second based on tickRate)
// This is where ALL game logic happens
// =====================
export function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {

  logger.info("matchLoop tick — gameOver: %s, messages: %d", 
  state.gameOver, messages.length);

  // If game is over, return null to END the match
  if (state.gameOver) {
    logger.info("Game over — ending match");
    return null;
  }

  // Process each message that came in since last tick
  messages.forEach(function (message) {
    const senderId = message.sender.userId;

    // Only process MOVE opcodes
    if (message.opCode !== OPCODE_MOVE) return;

    // Parse the move data
    // Client sends: { position: 4 }  (0-8, the cell index)
    const data = JSON.parse(nk.binaryToString(message.data));
    const position = data.position;

    logger.info("Move received from %s at position %d", senderId, position);

    // ---- VALIDATION ----

    // Is it this player's turn?
    if (state.currentTurn !== senderId) {
      logger.warn("Not this player's turn: %s", senderId);
      return; // ignore the move
    }

    // Is the position valid? (0-8)
    if (position < 0 || position > 8) {
      logger.warn("Invalid position: %d", position);
      return;
    }

    // Is the cell already taken?
    if (state.board[position] !== null) {
      logger.warn("Cell already taken: %d", position);
      return;
    }

    // ---- APPLY THE MOVE ----
    const symbol = state.playerSymbols[senderId];
    state.board[position] = symbol;

    // Get opponent ID cleanly — no looping needed since we only have 2 players
    const playerIds = Object.keys(state.players);
    const opponentId = playerIds[0] === senderId ? playerIds[1] : playerIds[0];

    // ── CHECK WIN ──
    const winner = checkWinner(state.board);

    if (winner) {

      logger.info("Winner found! saving stats now...");

      // Someone won!
      state.gameOver = true;
      state.winner = senderId;

      // Save to permanent storage — genuine win, face to face
      saveMatchResult(
        nk, logger,
        senderId,       // winner
        opponentId,     // loser
        "win",
        "loss",
        REASON_NORMAL,  // genuine face-to-face win
        ctx.matchId
      );

      dispatcher.broadcastMessage(
        OPCODE_GAME_OVER,
        JSON.stringify({
          board: state.board,
          winner: senderId,
          winnerSymbol: symbol
        }),
        null,
        null
      );
      return;
    }

    // ---- CHECK DRAW ----
    const isDraw = state.board.every(function (cell) {
      return cell !== null;
    });

    if (isDraw) {
      state.gameOver = true;

      // Save to permanent storage — draw has no reason
      saveMatchResult(
        nk, logger,
        playerIds[0],
        playerIds[1],
        "draw",
        "draw",
        "",            // draw has no reason
        ctx.matchId
      );

      dispatcher.broadcastMessage(
        OPCODE_DRAW,
        JSON.stringify({ board: state.board }),
        null, null
      );
      return;
    }

    // ── SWITCH TURNS ──
    state.currentTurn = opponentId;

    // ── BROADCAST NEW BOARD STATE to both players ──
    dispatcher.broadcastMessage(
      OPCODE_GAME_STATE,
      JSON.stringify({
        board: state.board,
        currentTurn: state.currentTurn,
        lastMove: { position, symbol, playerId: senderId }
      }),
      null,
      null
    );
  });

  return { state };
}

// =====================
// checkWinner — pure game logic
// Returns the winning symbol ("X" or "O") or null
// =====================
export function checkWinner(board: Array<string | null>): string | null {
  // All possible winning combinations
  const lines = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal
    [2, 4, 6], // diagonal
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // returns "X" or "O"
    }
  }

  return null; // no winner yet
}

// =====================
// matchLeave
// Called when a player disconnects
// =====================
export function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {

  if (!presences || presences.length === 0) {
    logger.warn("matchLeave called with no presences — ignoring");
    return { state };
  }

  const leavingPlayerId = presences[0].userId;
  delete state.players[leavingPlayerId];
  logger.info("Player left: %s", leavingPlayerId);

  // If a player left mid-game, end the match
  if (Object.keys(state.players).length < 2 && !state.gameOver) {

    const remainingPlayerId = Object.keys(state.players)[0];

    // Save result — remaining player wins because partner abandoned
    if (remainingPlayerId) {
      saveMatchResult(
        nk, logger,
        remainingPlayerId,   // winner — stayed in game
        leavingPlayerId,     // loser — abandoned the game
        "win",
        "loss",
        REASON_PARTNER_LEFT, // reason: partner left mid-game
        ctx.matchId
      );
    }

    // Tell remaining player before match ends
    dispatcher.broadcastMessage(
      OPCODE_PARTNER_LEFT,
      JSON.stringify({ reason: "partner_left" }),
      null,
      null
    );

    logger.info("Player disconnected — ending match");
    return null;
  }

  return { state };
}

// =====================
// matchTerminate
// Called when server is shutting down gracefully
// =====================
export function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {

  logger.info("Match terminating — grace period: %d seconds", graceSeconds);

  dispatcher.broadcastMessage(
    OPCODE_SERVER_SHUTDOWN,
    JSON.stringify({ reason: "Server shutting down" }),
    null, null
  );

  return { state };
}

// =====================
// matchSignal
// Required by Nakama to register — not used in Tic-Tac-Toe
// =====================
export function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState, data?: string } | null {
  return { state, data };
}

// =====================
// rpcCreateMatch
// RPC called by client to create a new match room
// Returns matchId — client then calls socket.joinMatch(matchId)
// =====================
export function rpcCreateMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const matchId = nk.matchCreate(MODULE_NAME, {});
  logger.info("Match created with ID: %s", matchId);
  return JSON.stringify({ matchId });
}

// =====================
// rpcGetStats
// RPC called by client to fetch their stats + match history
// Returns summary totals + last 20 match rows
// =====================
export function rpcGetStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {

  const userId = ctx.userId;

  // Read summary
  let summary = { wins: 0, losses: 0, draws: 0 };
  try {
    const summaryRead = nk.storageRead([{
      collection: "stats",
      key: "summary",
      userId: userId
    }]);
    if (summaryRead && summaryRead.length > 0) {
      const rawSummary = summaryRead[0].value;
      if (typeof rawSummary === "string") {
        summary = JSON.parse(rawSummary);
      } else if (rawSummary && typeof rawSummary === "object") {
        summary = {
          wins: typeof rawSummary.wins === "number" ? rawSummary.wins : 0,
          losses: typeof rawSummary.losses === "number" ? rawSummary.losses : 0,
          draws: typeof rawSummary.draws === "number" ? rawSummary.draws : 0,
        };
      }
    }
  } catch (e) {
    logger.warn("No summary found for %s", userId);
  }

  // List all match_ keys for this user
  // storageList returns paginated results for a collection + userId
  let matchHistory: any[] = [];
  try {
    const matchRecords = nk.storageList(userId, "stats", 20);
    if (matchRecords && matchRecords.objects) {
      matchHistory = matchRecords.objects
        .filter(function (obj: any) {
          return obj.key.startsWith("match_");
        })
        .map(function (obj: any) {
          const raw = obj.value;
          let val: any;
          if (typeof raw === "string") {
            val = JSON.parse(raw);
          } else {
            val = raw;
          }
          return {
            matchId: obj.key.replace("match_", ""),
            result: val.result,
            reason: val.reason,
            opponent: val.opponent,
            timestamp: val.timestamp
          };
        })
        // Sort newest first
        .sort(function (a: any, b: any) {
          return b.timestamp - a.timestamp;
        });
    }
  } catch (e) {
    logger.warn("Could not fetch match history for %s", userId);
  }

  return JSON.stringify({ summary, matchHistory });
}