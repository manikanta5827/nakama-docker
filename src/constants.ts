// opcodes for message types
export const OPCODE_MOVE = 1;
export const OPCODE_GAME_STATE = 2;
export const OPCODE_GAME_OVER = 3;
export const OPCODE_START = 4;
export const OPCODE_DRAW = 5;
export const OPCODE_PARTNER_LEFT = 6;
export const OPCODE_SERVER_SHUTDOWN = 7;

export const MODULE_NAME = "tictactoe";

// reasons for match end
export const REASON_NORMAL = "normal";
export const REASON_PARTNER_LEFT = "partner_left";
export const REASON_TIMEOUT = "timeout";

// match state structure
export interface MatchState {
  board: Array<string | null>;
  players: {[userId: string]: nkruntime.Presence};
  playerSymbols: {[userId: string]: string};
  currentTurn: string | null;
  gameOver: boolean;
  winner: string | null;
}
