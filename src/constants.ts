// Think of opcodes like event type numbers
// Client and server use these numbers to know what a message means

export const OPCODE_MOVE = 1;         // player made a move
export const OPCODE_GAME_STATE = 2;   // server broadcasting board
export const OPCODE_GAME_OVER = 3;    // someone won or draw
export const OPCODE_START = 4;        // game is starting

export const MODULE_NAME = "tictactoe";

// The match state shape — this is your "database" for one game session
export interface MatchState {
  board: Array<string | null>;  // 9 cells, null = empty, "X" or "O"
  players: {[userId: string]: nkruntime.Presence};
  playerSymbols: {[userId: string]: string}; // userId → "X" or "O"
  currentTurn: string | null;   // userId of who moves next
  gameOver: boolean;
  winner: string | null;        // userId of winner, null if draw
}