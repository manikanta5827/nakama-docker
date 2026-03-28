import {
  OPCODE_MOVE,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_START,
  MODULE_NAME,
  OPCODE_DRAW,
  OPCODE_SERVER_SHUTDOWN,
  OPCODE_PARTNER_LEFT,
  OPCODE_TIMEOUT,
  OPCODE_TIMER_UPDATE,
  REASON_NORMAL,
  REASON_PARTNER_LEFT,
  REASON_TIMEOUT,
  TURN_TIMEOUT_SECONDS,
} from './constants';

// writes match results to storage and updates leaderboard
function saveMatchResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  player1Id: string,
  player2Id: string,
  player1Result: string,
  player2Result: string,
  reason: string,
  matchId: string,
  moves: any[],
  finalBoard: any[]
): void {
  try {
    logger.info('saving match result for %s and %s', player1Id, player2Id);
    const timestamp = Date.now();

    const writeForPlayer = (
      userId: string,
      opponentId: string,
      result: string
    ) => {
      let summary = { wins: 0, losses: 0, draws: 0 };

      try {
        // reads existing player summary
        const existing = nk.storageRead([
          {
            collection: 'stats',
            key: 'summary',
            userId: userId,
          },
        ]);

        if (existing && existing.length > 0) {
          const rawValue = existing[0].value;
          if (rawValue) {
            summary = {
              wins: Number(rawValue.wins) || 0,
              losses: Number(rawValue.losses) || 0,
              draws: Number(rawValue.draws) || 0,
            };
          }
        }
      } catch (e) {
        logger.warn('no summary found for %s', userId);
      }

      // updates summary totals
      if (result === 'win') summary.wins += 1;
      if (result === 'loss') summary.losses += 1;
      if (result === 'draw') summary.draws += 1;

      // updates global leaderboard on win
      if (result === 'win') {
        try {
          nk.leaderboardRecordWrite(
            'global_wins',
            userId,
            '',
            100,
            0,
            {}
          );
        } catch (error) {
          logger.error('leaderboard write failed: %s', error.message);
        }
      }

      // saves summary and match record
      try {
        nk.storageWrite([
          {
            collection: 'stats',
            key: 'summary',
            userId: userId,
            value: {
              wins: summary.wins,
              losses: summary.losses,
              draws: summary.draws,
            } as any,
            permissionRead: 1,
            permissionWrite: 0,
          },
          {
            collection: 'stats',
            key: 'match_' + matchId,
            userId: userId,
            value: {
              result: String(result),
              reason: String(reason),
              opponent: String(opponentId),
              timestamp: Number(timestamp),
              moves: moves,
              finalBoard: finalBoard,
            } as any,
            permissionRead: 1,
            permissionWrite: 0,
          },
        ]);
      } catch (error) {
        logger.error('storage write error: %s', JSON.stringify(error));
      }
    };

    writeForPlayer(player1Id, player2Id, player1Result);
    writeForPlayer(player2Id, player1Id, player2Result);
  } catch (error) {
    logger.error('error saving match result: %s', JSON.stringify(error));
  }
}

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
  presences.forEach(function (presence) {
    state.players[presence.userId] = presence;

    if (state.presencesOrder && state.presencesOrder.length > 0) {
      const index = state.presencesOrder.indexOf(presence.userId);
      if (index !== -1) {
        state.playerSymbols[presence.userId] = index === 0 ? 'X' : 'O';
      } else {
        const playerCount = Object.keys(state.players).length;
        state.playerSymbols[presence.userId] = playerCount === 1 ? 'X' : 'O';
      }
    } else {
      const playerCount = Object.keys(state.players).length;
      state.playerSymbols[presence.userId] = playerCount === 1 ? 'X' : 'O';
    }

    logger.info('player joined: %s', presence.userId);
  });

  const playerCount = Object.keys(state.players).length;

  if (playerCount === 2) {

    // fetches player display names
    const playerIds = Object.keys(state.players);
    const accounts = nk.usersGetId(playerIds);
    const displayNames: { [key: string]: string } = {};
    accounts.forEach(function (account) {
      displayNames[account.userId] = account.displayName || account.username || 'unknown';
    });

    // get x-player and set starting turn
    const xPlayerId = Object.keys(state.playerSymbols).find(function (id) {
      return state.playerSymbols[id] === 'X';
    });

    state.currentTurn = xPlayerId || null;
    state.turnStartTick = tick;
    logger.info('game starting, turn: %s', state.currentTurn);

    // broadcasts start message
    dispatcher.broadcastMessage(
      OPCODE_START,
      JSON.stringify({
        board: state.board,
        playerSymbols: state.playerSymbols,
        currentTurn: state.currentTurn,
        displayNames: displayNames,
      }),
      null,
      null
    );
  }

  return { state };
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
  if (state.gameOver) return null;

  // check timeout at top of every tick
  if (state.currentTurn && Object.keys(state.players).length === 2) {
    const ticksElapsed = tick - state.turnStartTick;

    // calculates remaining time and broadcasts timer update
    const ticksRemaining = state.timeoutTicks - ticksElapsed;
    const secondsRemaining = Math.ceil(ticksRemaining / 5);

    if (ticksElapsed >= state.timeoutTicks) {
      state.gameOver = true;
      const playerIds = Object.keys(state.players);
      const timedOutId = state.currentTurn;
      const winnerId = playerIds.find((id) => id !== timedOutId) || '';

      logger.info('player %s timed out - %s wins', timedOutId, winnerId);

      saveMatchResult(
        nk,
        logger,
        winnerId,
        timedOutId,
        'win',
        'loss',
        REASON_TIMEOUT,
        state.matchId,
        state.moves,
        state.board
      );

      dispatcher.broadcastMessage(
        OPCODE_TIMEOUT,
        JSON.stringify({
          timedOutPlayer: timedOutId,
          winner: winnerId,
          board: state.board,
        }),
        null,
        null
      );

      return null;
    }

    // broadcast timer update every tick
    dispatcher.broadcastMessage(
      OPCODE_TIMER_UPDATE,
      JSON.stringify({
        currentTurn: state.currentTurn,
        secondsRemaining: secondsRemaining,
      }),
      null,
      null
    );
  }

  messages.forEach(function (message) {
    try {
      const senderId = message.sender.userId;
      if (message.opCode !== OPCODE_MOVE) return;

      const data = JSON.parse(nk.binaryToString(message.data));
      const position = data.position;

      // move validation
      if (state.currentTurn !== senderId) return;
      if (position < 0 || position > 8) return;
      if (state.board[position] !== null) return;

      const symbol = state.playerSymbols[senderId];
      state.board[position] = symbol;

      // records move
      state.moves.push({
        playerId: senderId,
        symbol: symbol,
        position: position,
        moveIndex: state.moves.length,
      });

      const playerIds = Object.keys(state.players);
      const opponentId = playerIds[0] === senderId ? playerIds[1] : playerIds[0];

      // checks for winner
      const winner = checkWinner(state.board);
      if (winner) {
        logger.info('winner detected: %s', senderId);
        state.gameOver = true;
        state.winner = senderId;

        saveMatchResult(
          nk,
          logger,
          senderId,
          opponentId,
          'win',
          'loss',
          REASON_NORMAL,
          state.matchId,
          state.moves,
          state.board
        );

        dispatcher.broadcastMessage(
          OPCODE_GAME_OVER,
          JSON.stringify({
            board: state.board,
            winner: senderId,
            winnerSymbol: symbol,
          }),
          null,
          null
        );
        return;
      }

      // checks for draw
      const isDraw = state.board.every(function (cell) {
        return cell !== null;
      });

      if (isDraw) {
        logger.info('match draw');
        state.gameOver = true;
        saveMatchResult(
          nk,
          logger,
          playerIds[0],
          playerIds[1],
          'draw',
          'draw',
          '',
          state.matchId,
          state.moves,
          state.board
        );

        dispatcher.broadcastMessage(
          OPCODE_DRAW,
          JSON.stringify({ board: state.board }),
          null,
          null
        );
        return;
      }

      // switches turns and broadcasts state
      state.currentTurn = opponentId;
      state.turnStartTick = tick;

      dispatcher.broadcastMessage(
        OPCODE_GAME_STATE,
        JSON.stringify({
          board: state.board,
          currentTurn: state.currentTurn,
          lastMove: { position, symbol, playerId: senderId },
        }),
        null,
        null
      );
    } catch (error) {
      logger.error('error processing message: %s', error.message);
    }
  });

  return { state };
}

// checks if a player has won
export function checkWinner(board: Array<string | null>): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
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
  if (!presences || presences.length === 0) return { state };

  const leavingPlayerId = presences[0].userId;
  delete state.players[leavingPlayerId];
  logger.info('player left: %s', leavingPlayerId);

  // ends match if player leaves mid-game
  if (Object.keys(state.players).length < 2 && !state.gameOver) {
    const remainingPlayerId = Object.keys(state.players)[0];
    if (remainingPlayerId) {
      saveMatchResult(
        nk,
        logger,
        remainingPlayerId,
        leavingPlayerId,
        'win',
        'loss',
        REASON_PARTNER_LEFT,
        state.matchId,
        state.moves,
        state.board
      );
    }

    dispatcher.broadcastMessage(
      OPCODE_PARTNER_LEFT,
      JSON.stringify({ reason: 'partner_left' }),
      null,
      null
    );

    return null;
  }

  return { state };
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
  const matchId = nk.matchCreate(MODULE_NAME, {});
  logger.info('match created via rpc: %s', matchId);
  return JSON.stringify({ matchId });
}

// rpc to get player stats and history
export function rpcGetStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const userId = ctx.userId;
  let summary = { wins: 0, losses: 0, draws: 0 };

  try {
    const summaryRead = nk.storageRead([
      { collection: 'stats', key: 'summary', userId: userId },
    ]);
    if (summaryRead && summaryRead.length > 0) {
      const rawSummary = summaryRead[0].value;
      summary = {
        wins: Number(rawSummary.wins) || 0,
        losses: Number(rawSummary.losses) || 0,
        draws: Number(rawSummary.draws) || 0,
      };
    }
  } catch (e) {
    logger.warn('no summary found for %s', userId);
  }

  let matchHistory: any[] = [];
  try {
    const matchRecords = nk.storageList(userId, 'stats', 20);
    if (matchRecords && matchRecords.objects) {
      matchHistory = matchRecords.objects
        .filter(function (obj: any) {
          return obj.key.startsWith('match_');
        })
        .map(function (obj: any) {
          const raw = obj.value;
          return {
            matchId: obj.key.replace('match_', ''),
            result: String(raw.result),
            reason: String(raw.reason),
            opponent: String(raw.opponent),
            timestamp: Number(raw.timestamp),
          };
        })
        .sort(function (a: any, b: any) {
          return b.timestamp - a.timestamp;
        });
    }
  } catch (e) {
    logger.warn('could not fetch match history for %s', userId);
  }

  return JSON.stringify({ summary, matchHistory });
}

// rpc to get specific match details
export function rpcGetMatchDetail(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const userId = ctx.userId;
  const data = JSON.parse(payload);
  const matchId = data.matchId;

  try {
    const records = nk.storageRead([
      { collection: 'stats', key: 'match_' + matchId, userId: userId },
    ]);

    if (!records || records.length === 0) {
      return JSON.stringify({ error: 'match not found' });
    }

    const raw = records[0].value;
    return JSON.stringify({
      matchId,
      result: String(raw.result),
      reason: String(raw.reason),
      opponent: String(raw.opponent),
      timestamp: Number(raw.timestamp),
      moves: raw.moves || [],
      finalBoard: raw.finalBoard || [],
    });
  } catch (e) {
    logger.error('rpcGetMatchDetail error: %s', JSON.stringify(e));
    return JSON.stringify({ error: 'failed to fetch match detail' });
  }
}

// rpc to get global leaderboard
export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  try {
    const records = nk.leaderboardRecordsList('global_wins', [ctx.userId], 20, '', null);
    const ownerIds = records.records
      .map((record) => record.ownerId)
      .filter((value, index, self) => self.indexOf(value) === index);

    const accounts = ownerIds.length ? nk.usersGetId(ownerIds) : [];
    const accountNameById: { [key: string]: string } = {};

    accounts.forEach(function (account) {
      accountNameById[account.userId] = account.displayName || account.username || 'unknown';
    });

    const leaderboard = records.records.map(function (record) {
      return {
        rank: record.rank,
        userId: record.ownerId,
        username: accountNameById[record.ownerId] || record.username || 'unknown',
        score: record.score,
        wins: Math.floor(record.score / 100),
      };
    });

    return JSON.stringify({ leaderboard });
  } catch (e) {
    logger.error('rpcGetLeaderboard error: %s', JSON.stringify(e));
    return JSON.stringify({ error: 'failed to fetch leaderboard' });
  }
}

// handles matchmaking success
export function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {
  const userIds = matches.map((m) => m.presence.userId).join(',');
  const matchId = nk.matchCreate(MODULE_NAME, { userIds });
  logger.info('matchmaker matched, created: %s', matchId);
  return matchId;
}
