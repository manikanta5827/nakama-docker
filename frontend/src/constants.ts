export const OPCODE_MOVE = 1;
export const OPCODE_GAME_STATE = 2;
export const OPCODE_GAME_OVER = 3;
export const OPCODE_START = 4;
export const OPCODE_DRAW = 5;
export const OPCODE_PARTNER_LEFT = 6;
export const OPCODE_SERVER_SHUTDOWN = 7;
export const OPCODE_TIMEOUT = 8;
export const OPCODE_TIMER_UPDATE = 9;

export const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "localhost";
export const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
export const NAKAMA_SSL = import.meta.env.VITE_NAKAMA_SSL === "true";
export const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";

export const MODULE_NAME = "tictactoe";
