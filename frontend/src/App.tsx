import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Session, type Socket } from '@heroiclabs/nakama-js';
import {
  OPCODE_MOVE,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_START,
  OPCODE_DRAW,
  OPCODE_PARTNER_LEFT,
  OPCODE_SERVER_SHUTDOWN,
  OPCODE_TIMEOUT,
  OPCODE_TIMER_UPDATE,
  NAKAMA_HOST,
  NAKAMA_PORT,
  NAKAMA_SERVER_KEY,
  NAKAMA_SSL,
} from '@/constants';
import {
  type Board,
  type MatchRecord,
  type MatchDetail,
  type LeaderboardEntry,
} from '@/types';
import {
  fetchStats,
  joinMatchById,
  createMatch,
  joinMatch,
  leaveGame,
  fetchMatchDetail,
  fetchLeaderboard,
} from '@/lib/helper';
import { Button } from '@/components/ui/button';
import { LogOut, Copy, Check } from 'lucide-react';
import { GameHeader } from '@/components/GameHeader';
import { LobbyButtons } from '@/components/LobbyButtons';
import { GameBoard } from '@/components/GameBoard';
import { StatsPanel } from '@/components/StatsPanel';
import { MatchReplay } from '@/components/MatchReplay';

// ── Main Component ─────────────────────────────────────────
export default function App() {
  const [client, setClient] = useState<Client | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const [winner, setWinner] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [summary, setSummary] = useState({ wins: 0, losses: 0, draws: 0 });
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [matchmakerTicket, setMatchmakerTicket] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  const [showReplay, setShowReplay] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [matchIdCopied, setMatchIdCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number | null>(null);

  const stopSearchTimer = () => {
    if (searchTimerRef.current !== null) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (refreshCountdown === null) return;

    if (refreshCountdown <= 0) {
      window.location.reload();
      return;
    }

    const timer = setTimeout(() => {
      setRefreshCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [refreshCountdown]);

  const copyMatchIdToClipboard = async () => {
    if (!matchId) return;
    try {
      await navigator.clipboard.writeText(matchId);
      setMatchIdCopied(true);
      setTimeout(() => setMatchIdCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy match ID:', err);
    }
  };

  // ── Init Nakama ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const newClient = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SSL);
      setClient(newClient);

      let deviceId = localStorage.getItem('nakama_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('nakama_device_id', deviceId);
      }

      try {
        const newSession = await newClient.authenticateDevice(deviceId, true);
        setSession(newSession);

        if (newSession.user_id) {
          localStorage.setItem('nakama_user_id', newSession.user_id);
        }

        let name = localStorage.getItem('nakama_display_name');
        if (!name || name === 'null' || name === 'undefined') {
          console.log('No display name found, prompting user...');
          const indianNames = [
            'Arjun',
            'Aditya',
            'Aarav',
            'Vihaan',
            'Reyansh',
            'Ishaan',
            'Sai',
            'Krishna',
            'Ananya',
            'Diya',
            'Aadhya',
            'Saanvi',
            'Myra',
            'Kavya',
            'Pari',
            'Zara',
            'Rahul',
            'Rohit',
            'Amit',
            'Vikram',
            'Priya',
            'Neha',
            'Sneha',
            'Anjali',
            'Ishan',
            'Karan',
            'Meera',
            'Riya',
            'Siddharth',
            'Varun',
          ];

          const userInput = prompt('Welcome! Enter your display name:');
          const randomName =
            indianNames[Math.floor(Math.random() * indianNames.length)];

          name =
            userInput && userInput.trim().length > 0
              ? userInput.trim()
              : `${randomName}`;

          const emojis = ['🤖', '👾', '🦄', '🐉', '👻', '🎃', '⭐', '🔥', '💎'];
          name =
            emojis[Math.floor(Math.random() * emojis.length)] + '  ' + name;

          localStorage.setItem('nakama_display_name', name);
        } else {
          console.log('Using existing display name:', name);
        }
        setDisplayName(name);

        await newClient.updateAccount(newSession, { display_name: name });

        const newSocket = newClient.createSocket(NAKAMA_SSL, false);
        await newSocket.connect(newSession, true);
        setSocket(newSocket);
        setStatus('Ready to play');

        await fetchStats(
          newClient,
          newSession,
          setSummary,
          setMatchHistory,
          setLoadingStats
        );
        await fetchLeaderboard(
          newClient,
          newSession,
          setLeaderboard,
          setLoadingLeaderboard
        );
      } catch (e) {
        console.error('Init error:', e);
        setStatus('Connection Failed');
      }
    };

    init();
  }, []);

  // ── Fetch Stats from Server ──────────────────────────────
  const handleFetchStats = useCallback(() => {
    fetchStats(client, session, setSummary, setMatchHistory, setLoadingStats);
  }, [client, session]);

  const handleFetchLeaderboard = useCallback(() => {
    fetchLeaderboard(client, session, setLeaderboard, setLoadingLeaderboard);
  }, [client, session]);

  const handleMatchClick = useCallback(
    async (match: MatchRecord) => {
      const detail = await fetchMatchDetail(client, session, match.matchId);
      if (detail) {
        setSelectedMatch(detail);
        setShowReplay(true);
      }
    },
    [client, session]
  );

  useEffect(() => {
    if (!socket || !session) return;

    socket.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      const data = JSON.parse(new TextDecoder().decode(matchData.data));

      switch (opCode) {
        case OPCODE_START:
          console.log('Match started:', data);
          setBoard(data.board);
          setMySymbol(
            session.user_id ? data.playerSymbols[session.user_id] : null
          );
          setCurrentTurn(data.currentTurn);
          setSecondsRemaining(null);

          const opponentId = Object.keys(data.playerSymbols).find(
            (id) => id !== session.user_id
          );

          if (opponentId && data.displayNames) {
            setOpponentName(data.displayNames[opponentId]);
          }

          setStatus('Game on!');
          break;

        case OPCODE_GAME_STATE:
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);

          if (session?.user_id) {
            setStatus(
              data.currentTurn === session.user_id
                ? 'Your Turn'
                : "Opponent's Turn"
            );
          }
          break;

        case OPCODE_GAME_OVER:
          setBoard(data.board);
          setWinner(data.winnerSymbol);
          setStatus('Game Over');
          setSecondsRemaining(null);
          stopSearchTimer();
          setRefreshCountdown(10);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_DRAW:
          setBoard(data.board);
          setIsDraw(true);
          setStatus('Draw!');
          setSecondsRemaining(null);
          stopSearchTimer();
          setRefreshCountdown(10);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_PARTNER_LEFT:
          setStatus('Opponent left — You Win! 🏆');
          setWinner('You Win');
          setSecondsRemaining(null);
          stopSearchTimer();
          setRefreshCountdown(10);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_TIMEOUT:
          setBoard(data.board);
          if (data.winner === session?.user_id) {
            setStatus('Opponent timed out — You Win! ⏰🏆');
            setWinner('You Win');
          } else {
            setStatus('You ran out of time — You Lose ⏰');
            setWinner(data.winnerSymbol || 'Opponent');
          }
          setSecondsRemaining(null);
          setRefreshCountdown(10);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_TIMER_UPDATE:
          setSecondsRemaining(data.secondsRemaining);
          break;

        case OPCODE_SERVER_SHUTDOWN:
          setStatus('Server shutting down...');
          break;
      }
    };

    socket.onmatchmakermatched = async (matched) => {
      try {
        console.log('Match found:', matched);
        setStatus('Opponent found! Joining...');

        let joinedMatchId = matched.match_id ?? null;

        if (!joinedMatchId && matched.token) {
          const tokenParts = matched.token.split('.');
          if (tokenParts.length > 1) {
            const tokenBody = JSON.parse(atob(tokenParts[1]));
            joinedMatchId = tokenBody.mid ?? tokenBody.match_id ?? null;
          }
        }

        if (!joinedMatchId) {
          throw new Error(
            'Unable to determine match ID from matchmaking response'
          );
        }

        setMatchId(joinedMatchId);
        setMatchmakerTicket(null);
        stopSearchTimer();

        await socket.joinMatch(joinedMatchId);
      } catch (e) {
        console.error('Join matched error:', e);
        setStatus('Failed to join match');
        stopSearchTimer();
      }
    };
  }, [socket, session, client, handleFetchStats]);

  useEffect(() => {
    return () => {
      stopSearchTimer();
    };
  }, []);

  // ── Match Actions ────────────────────────────────────────
  const handleJoinMatchById = useCallback(
    (id: string) => {
      joinMatchById(id, socket, setMatchId, setStatus);
    },
    [socket]
  );

  const handleCreateMatch = useCallback(() => {
    createMatch(client, session, socket, handleJoinMatchById);
  }, [client, session, socket, handleJoinMatchById]);

  const handleJoinMatch = useCallback(() => {
    joinMatch(handleJoinMatchById);
  }, [handleJoinMatchById]);

  const handleLeaveGame = useCallback(() => {
    leaveGame();
  }, []);

  const handleFindMatch = useCallback(async () => {
    if (!socket) return;

    try {
      const ticket = await socket.addMatchmaker(
        '*',
        2,
        2,
        {
          start_time: Date.now().toString(),
        },
        {}
      );
      setMatchmakerTicket(ticket.ticket);

      let timer = 1;
      setStatus('Searching... 1');

      stopSearchTimer();
      searchTimerRef.current = window.setInterval(() => {
        timer += 1;
        setStatus(`Searching... ${timer}`);
      }, 1000);
    } catch (e) {
      console.error('Find match error:', e);
      setStatus('Failed to find match');
      stopSearchTimer();
    }
  }, [socket]);

  const handleCancelSearch = useCallback(async () => {
    if (!socket || !matchmakerTicket) return;

    try {
      await socket.removeMatchmaker(matchmakerTicket);
      setMatchmakerTicket(null);
      setStatus('Ready to play');
      stopSearchTimer();
    } catch (e) {
      console.error('Cancel search error:', e);
    }
  }, [socket, matchmakerTicket]);

  const makeMove = useCallback(
    (position: number) => {
      if (
        !socket ||
        !matchId ||
        board[position] ||
        currentTurn !== session?.user_id ||
        winner ||
        isDraw
      )
        return;

      socket.sendMatchState(matchId, OPCODE_MOVE, JSON.stringify({ position }));
    },
    [socket, matchId, board, currentTurn, session?.user_id, winner, isDraw]
  );

  const isMyTurn = currentTurn === session?.user_id;

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:overflow-hidden bg-background text-foreground font-sans dark">
      {/* ── Left Panel: Game area ── */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 md:p-10 border-b md:border-b-0 md:border-r border-border md:overflow-y-auto">
        <GameHeader displayName={displayName} status={status} />

        {matchId && (
          <div className="w-full max-w-md space-y-4 mb-8">
            <div className="flex flex-col gap-2 p-4 bg-muted/20 rounded-xl border border-border">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">
                    {displayName ?? 'You'}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-semibold">
                    {opponentName ?? 'Waiting...'}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  You are{' '}
                  <span className="text-primary font-black ml-1">
                    {mySymbol ?? '-'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{matchId.substring(0, 12)}...</span>
                  <button
                    onClick={copyMatchIdToClipboard}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    {matchIdCopied ? (
                      <Check className="size-3 text-green-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive h-7"
                  onClick={handleLeaveGame}
                >
                  <LogOut className="mr-1.5 size-3" />
                  Leave
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold text-primary uppercase tracking-wider">
                  {winner
                    ? winner === 'You Win' || winner === mySymbol
                      ? '🏆 You Win!'
                      : `💀 You Lost! (${winner} Wins)`
                    : isDraw
                      ? '🤝 Draw!'
                      : isMyTurn
                        ? '🎯 Your Turn'
                        : '⏳ Waiting for opponent...'}
                </span>
                {refreshCountdown !== null ? (
                  <span className="text-xs text-muted-foreground mt-1 font-medium">
                    Returning to lobby in{' '}
                    <span className="text-primary font-bold">
                      {refreshCountdown}s
                    </span>
                    ...
                  </span>
                ) : (
                  matchId &&
                  secondsRemaining !== null &&
                  !winner &&
                  !isDraw && (
                    <span
                      className={`text-xs font-mono ${
                        secondsRemaining <= 10
                          ? 'text-destructive animate-pulse'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Time Remaining: {secondsRemaining}s
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {!matchId && !matchmakerTicket && (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm min-h-[300px]">
            <LobbyButtons
              onCreateMatch={handleCreateMatch}
              onJoinMatch={handleJoinMatch}
              onFindMatch={handleFindMatch}
            />
          </div>
        )}

        {!matchId && matchmakerTicket && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
            <div className="space-y-2">
              <p className="text-2xl font-black text-primary animate-pulse">
                {status}
              </p>
              <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">
                Finding an opponent
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="px-10 border-destructive text-destructive hover:bg-destructive/10"
              onClick={handleCancelSearch}
            >
              Cancel Search
            </Button>
          </div>
        )}

        {matchId && (
          <div className="flex-1 flex flex-col items-center justify-center w-full py-4 min-h-[400px]">
            <GameBoard
              board={board}
              isMyTurn={isMyTurn}
              winner={winner}
              isDraw={isDraw}
              onMakeMove={makeMove}
            />
          </div>
        )}
      </div>

      {/* ── Right Panel: Stats ── */}
      <StatsPanel
        summary={summary}
        matchHistory={matchHistory}
        loadingStats={loadingStats}
        onRefreshStats={handleFetchStats}
        onMatchClick={handleMatchClick}
        leaderboard={leaderboard}
        loadingLeaderboard={loadingLeaderboard}
        onRefreshLeaderboard={handleFetchLeaderboard}
        currentUserId={session?.user_id}
      />

      {showReplay && selectedMatch && (
        <MatchReplay
          matchDetail={selectedMatch}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  );
}
