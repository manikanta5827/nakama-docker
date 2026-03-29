import {
  MODULE_NAME,
  REASON_NORMAL,
  REASON_TIMEOUT,
  REASON_PARTNER_LEFT,
  OPCODE_MOVE,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_DRAW,
  OPCODE_TIMEOUT,
  OPCODE_TIMER_UPDATE,
  OPCODE_START,
  OPCODE_PARTNER_LEFT as OPCODE_PARTNER_LEFT_NOTIFY,
} from './constants';

/**
 * Validates if there's a winner on the board
 */
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

/**
 * Saves match results to storage and updates leaderboards for both players
 */
export function saveMatchResult(
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
    logger.info('saving match result for %s and %s , results: %s, %s', player1Id, player2Id, player1Result, player2Result);
    const timestamp = Date.now();

    // 1. Batch Read summaries for CAS
    const summaries = nk.storageRead([
      { collection: 'stats', key: 'summary', userId: player1Id },
      { collection: 'stats', key: 'summary', userId: player2Id },
    ]);

    const getSummary = (userId: string) => {
      const record = summaries.find((r) => r.userId === userId);
      return {
        value: record ? (record.value as any) : { wins: 0, losses: 0, draws: 0 },
        version: record ? record.version : '*',
      };
    };

    const s1 = getSummary(player1Id);
    const s2 = getSummary(player2Id);

    const increment = (val: any, result: string) => {
      const newVal = {
        wins: Number(val.wins) || 0,
        losses: Number(val.losses) || 0,
        draws: Number(val.draws) || 0,
      };
      if (result === 'win') newVal.wins++;
      else if (result === 'loss') newVal.losses++;
      else if (result === 'draw') newVal.draws++;
      return newVal;
    };

    const writes: nkruntime.StorageWriteRequest[] = [
      // 1. ATOMIC SUMMARIES (CAS)
      {
        collection: 'stats',
        key: 'summary',
        userId: player1Id,
        value: increment(s1.value, player1Result),
        version: s1.version,
        permissionRead: 1,
        permissionWrite: 0,
      },
      {
        collection: 'stats',
        key: 'summary',
        userId: player2Id,
        value: increment(s2.value, player2Result),
        version: s2.version,
        permissionRead: 1,
        permissionWrite: 0,
      },
      // 2. GLOBAL HEAVY DETAIL
      {
        collection: 'stats',
        key: 'match_detail_' + matchId,
        userId: null,
        value: {
          matchId,
          player1Id,
          player2Id,
          player1Result,
          player2Result,
          reason,
          moves,
          finalBoard,
          timestamp,
        },
        permissionRead: 2, // Public read so either player can fetch it
        permissionWrite: 0,
      },
      // 3. PLAYER HISTORY POINTERS
      {
        collection: 'stats',
        key: 'match_h_' + matchId,
        userId: player1Id,
        value: {
          matchId,
          opponentId: player2Id,
          result: player1Result,
          reason,
          timestamp,
        },
        permissionRead: 1,
        permissionWrite: 0,
      },
      {
        collection: 'stats',
        key: 'match_h_' + matchId,
        userId: player2Id,
        value: {
          matchId,
          opponentId: player1Id,
          result: player2Result,
          reason,
          timestamp,
        },
        permissionRead: 1,
        permissionWrite: 0,
      },
    ];

    nk.storageWrite(writes);

    if (player1Result === 'win') nk.leaderboardRecordWrite('global_wins', player1Id, '', 100, 0, {});
    if (player2Result === 'win') nk.leaderboardRecordWrite('global_wins', player2Id, '', 100, 0, {});

    logger.info('Match %s results saved (IDs only for consistency)', matchId);
  } catch (error) {
    logger.error('Failed to save match result: %s', error.message);
  }
}

/**
 * Service to handle match creation
 */
export function createMatch(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  params: { [key: string]: string } = {}
): string {
  const matchId = nk.matchCreate(MODULE_NAME, params);
  logger.info('match created: %s', matchId);
  return matchId;
}

/**
 * Service to fetch user statistics and history
 */
export function getUserStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string
): { summary: any; matchHistory: any[] } {
  let summary = { wins: 0, losses: 0, draws: 0 };
  let matchHistory: any[] = [];

  try {
    const [summaryRead, historyList] = [
      nk.storageRead([{ collection: 'stats', key: 'summary', userId }]),
      nk.storageList(userId, 'stats', 50),
    ];

    if (summaryRead && summaryRead.length > 0) {
      summary = summaryRead[0].value as any;
    }

    if (historyList && historyList.objects) {
      const records = historyList.objects.filter((obj) => obj.key.startsWith('match_h_'));
      
      // Fetch opponent names at runtime
      const opponentIds = records.map((obj) => (obj.value as any).opponentId);
      const uniqueOpponentIds = Array.from(new Set(opponentIds));
      const opponentAccounts = uniqueOpponentIds.length > 0 ? nk.usersGetId(uniqueOpponentIds) : [];
      const nameMap: { [key: string]: string } = {};
      opponentAccounts.forEach((acc) => {
        nameMap[acc.userId] = acc.displayName || acc.username || 'unknown';
      });

      matchHistory = records
        .map((obj: any) => ({
          matchId: obj.value.matchId,
          result: obj.value.result,
          opponent: nameMap[obj.value.opponentId] || 'unknown',
          timestamp: obj.value.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (e) {
    logger.warn('Could not fetch user stats for %s: %s', userId, e.message);
  }

  return { summary, matchHistory };
}

/**
 * Service to fetch specific match details
 */
export function getMatchDetail(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  matchId: string
): any {
  try {
    const records = nk.storageRead([{ collection: 'stats', key: 'match_detail_' + matchId, userId: null }]);

    if (!records || records.length === 0) {
      return { error: 'match details not found' };
    }

    const data = records[0].value as any;
    const isP1 = data.player1Id === userId;
    const opponentId = isP1 ? data.player2Id : data.player1Id;

    // Fetch current opponent name
    const accounts = nk.usersGetId([opponentId]);
    const opponentName = accounts.length > 0 ? (accounts[0].displayName || accounts[0].username) : 'unknown';

    return {
      matchId,
      result: isP1 ? data.player1Result : data.player2Result,
      opponent: opponentName,
      opponentId: opponentId,
      timestamp: data.timestamp,
      moves: data.moves || [],
      finalBoard: data.finalBoard || [],
      reason: data.reason || 'normal',
    };
  } catch (e) {
    logger.error('getMatchDetail error: %s', e.message);
    return { error: 'failed to fetch match detail' };
  }
}

/**
 * Service to fetch global leaderboard rankings
 */
export function getLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string
): any {
  try {
    const records = nk.leaderboardRecordsList('global_wins', [userId], 20, '', null);
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

    return { leaderboard };
  } catch (e) {
    logger.error('getLeaderboard error: %s', JSON.stringify(e));
    return { error: 'failed to fetch leaderboard' };
  }
}

/**
 * Service to handle player joining the match
 */
export function handleMatchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } {
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

/**
 * Service to handle player leaving the match
 */
export function handleMatchLeave(
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
      OPCODE_PARTNER_LEFT_NOTIFY,
      JSON.stringify({ reason: 'partner_left' }),
      null,
      null
    );

    return null;
  }

  return { state };
}

/**
 * Service to handle the main match loop logic
 */
export function handleMatchLoop(
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
          REASON_NORMAL,
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
