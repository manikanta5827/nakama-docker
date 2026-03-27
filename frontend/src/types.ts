export type Board = (string | null)[];

export interface MatchRecord {
  matchId:   string;
  result:    "win" | "loss" | "draw";
  reason:    string;
  opponent:  string;
  timestamp: number;
}

export interface Summary {
  wins:   number;
  losses: number;
  draws:  number;
}

export interface Move {
  playerId:  string;
  symbol:    string;
  position:  number;
  moveIndex: number;
}

export interface MatchDetail {
  matchId:   string;
  result:    "win" | "loss" | "draw";
  reason:    string;
  opponent:  string;
  timestamp: number;
  moves:     Move[];
  finalBoard: Board;
}