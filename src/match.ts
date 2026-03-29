import {
  MODULE_NAME,
  OPCODE_SERVER_SHUTDOWN,
  TURN_TIMEOUT_SECONDS,
} from './constants';
import * as matchService from './services';

// initializes match state
export function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  logger.info('match created: %s', ctx.matchId);
  const state: nkruntime.MatchState = {
    board: Array(9).fill(null),
    players: {},
    playerSymbols: {},
    currentTurn: null,
    gameOver: false,
    winner: null,
    matchId: ctx.matchId.split('.')[0],
    moves: [],
    turnStartTick: 0,
    timeoutTicks: TURN_TIMEOUT_SECONDS * 5,
    presencesOrder: params['userIds'] ? params['userIds'].split(',') : [],
  };

  return {
    state,
    tickRate: 5,
    label: 'tictactoe',
  };
}

// validates player join attempt
export function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): {
  state: nkruntime.MatchState;
  accept: boolean;
  rejectMessage?: string;
} | null {
  const playerCount = Object.keys(state.players).length;

  if (playerCount >= 2) {
    return {
      state,
      accept: false,
      rejectMessage: 'match is full',
    };
  }

  return { state, accept: true };
}

// handles player join and starts game if full
export function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  return matchService.handleMatchJoin(ctx, logger, nk, dispatcher, tick, state, presences);
}

// main match loop for processing moves
export function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  return matchService.handleMatchLoop(ctx, logger, nk, dispatcher, tick, state, messages);
}

// handles player disconnect
export function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  return matchService.handleMatchLeave(ctx, logger, nk, dispatcher, tick, state, presences);
}

// handles server shutdown
export function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('match terminating');
  dispatcher.broadcastMessage(
    OPCODE_SERVER_SHUTDOWN,
    JSON.stringify({ reason: 'server shutting down' }),
    null,
    null
  );

  return { state };
}

// required match signal handler
export function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  return { state, data };
}

// rpc to create match
export function rpcCreateMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const matchId = matchService.createMatch(nk, logger);
  return JSON.stringify({ matchId });
}

// rpc to get player stats and history
export function rpcGetStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const stats = matchService.getUserStats(nk, logger, ctx.userId);
  return JSON.stringify(stats);
}

// rpc to get specific match details
export function rpcGetMatchDetail(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const data = JSON.parse(payload);
  const result = matchService.getMatchDetail(nk, logger, ctx.userId, data.matchId);
  return JSON.stringify(result);
}

// rpc to get global leaderboard
export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const result = matchService.getLeaderboard(nk, logger, ctx.userId);
  return JSON.stringify(result);
}

// handles matchmaking success
export function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {
  // sorts by start_time to ensure first clicker gets index 0
  const sortedMatches = matches.sort((a, b) => {
    const timeA = Number(a.properties['start_time']) || 0;
    const timeB = Number(b.properties['start_time']) || 0;
    return timeA - timeB;
  });

  const userIds = sortedMatches.map((m) => m.presence.userId).join(',');
  return matchService.createMatch(nk, logger, { userIds });
}
