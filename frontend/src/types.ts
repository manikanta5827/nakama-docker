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