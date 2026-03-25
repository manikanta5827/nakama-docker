import {
  OPCODE_MOVE,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_START,
  MODULE_NAME,
  OPCODE_DRAW,
  OPCODE_SERVER_SHUTDOWN,
  OPCODE_PARTNER_LEFT
} from './constants';

// =====================
// matchInit
// Called ONCE when match is created
// Like a constructor — set up your initial state
// =====================
export function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: {[key: string]: string}
): {state: nkruntime.MatchState, tickRate: number, label: string} {

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
    tickRate: 1,    // matchLoop runs 1 time per second (enough for Tic-Tac-Toe)
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
  metadata: {[key: string]: any}
): {state: nkruntime.MatchState, accept: boolean, rejectMessage?: string} | null {

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
): {state: nkruntime.MatchState} | null {

  presences.forEach(function(presence) {
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
): {state: nkruntime.MatchState} | null {

  // If game is over, return null to END the match
  if (state.gameOver) {
    logger.info("Game over — ending match");
    return null;
  }

  // Process each message that came in since last tick
  messages.forEach(function(message) {
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

    // ---- CHECK WIN ----
    const winner = checkWinner(state.board);

    if (winner) {
      // Someone won!
      state.gameOver = true;
      state.winner = senderId;

      dispatcher.broadcastMessage(
        OPCODE_GAME_OVER,
        JSON.stringify({
          board: state.board,
          winner: senderId,
          winnerSymbol: symbol,
          draw: false
        }),
        null,
        null
      );
      return;
    }

    // ---- CHECK DRAW ----
    const isDraw = state.board.every(function(cell) {
      return cell !== null;
    });

    if (isDraw) {
      state.gameOver = true;

      dispatcher.broadcastMessage(
        OPCODE_DRAW,
        JSON.stringify({
          board: state.board,
          winner: null,
          draw: true
        }),
        null,
        null
      );
      return;
    }

    // ---- SWITCH TURNS ----
    const playerIds = Object.keys(state.players);
    state.currentTurn = playerIds.find(function(id) {
      return id !== senderId;
    }) || null;

    // ---- BROADCAST NEW STATE to both players ----
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
): {state: nkruntime.MatchState} | null {

  presences.forEach(function(presence) {
    delete state.players[presence.userId];
    logger.info("Player left: %s", presence.userId);
  });

  // If a player left mid-game, end the match
  if (Object.keys(state.players).length < 2 && !state.gameOver) {
    logger.info("Player disconnected — ending match");

    // tell remaining player before ending
    dispatcher.broadcastMessage(
      OPCODE_PARTNER_LEFT,
      JSON.stringify({ reason: "partner_left" }),
      null,
      null
    );
    return null; // returning null ends the match
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
): {state: nkruntime.MatchState} | null {

  logger.info("Match terminating — grace period: %d seconds", graceSeconds);

  dispatcher.broadcastMessage(
    OPCODE_SERVER_SHUTDOWN,
    JSON.stringify({ reason: "Server shutting down" }),
    null,
    null
  );

  return { state };
}

// =====================
// matchSignal
// Called when server sends a signal to the match
// Not used for basic Tic-Tac-Toe but required to register
// =====================
export function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): {state: nkruntime.MatchState, data?: string} | null {
  return { state, data };
}

// RPC that a player calls to create a new match
// Returns the match ID so other player can join
export function rpcCreateMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {

  // nk.matchCreate() starts a new match using your match handler
  const matchId = nk.matchCreate(MODULE_NAME, {});
  logger.info("Match created with ID: %s", matchId);

  return JSON.stringify({ matchId });
}