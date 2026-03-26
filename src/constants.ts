// Think of opcodes like event type numbers
// Client and server use these numbers to know what a message means

export const OPCODE_MOVE = 1;
export const OPCODE_GAME_STATE = 2;
export const OPCODE_GAME_OVER = 3;
export const OPCODE_START = 4;
export const OPCODE_DRAW = 5;
export const OPCODE_PARTNER_LEFT = 6;
export const OPCODE_SERVER_SHUTDOWN = 7;

export const MODULE_NAME = "tictactoe";

// Win reasons — why did this result happen
export const REASON_NORMAL = "normal";           // genuine face to face
export const REASON_PARTNER_LEFT = "partner_left"; // opponent disconnected
export const REASON_TIMEOUT = "timeout";          // opponent timed out

// The match state shape — this is your "database" for one game session
export interface MatchState {
  board: Array<string | null>;  // 9 cells, null = empty, "X" or "O"
  players: {[userId: string]: nkruntime.Presence};
  playerSymbols: {[userId: string]: string}; // userId → "X" or "O"
  currentTurn: string | null;   // userId of who moves next
  gameOver: boolean;
  winner: string | null;        // userId of winner, null if draw
}