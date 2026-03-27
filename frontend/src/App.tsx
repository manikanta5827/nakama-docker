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
  NAKAMA_HOST,
  NAKAMA_PORT,
  NAKAMA_SERVER_KEY,
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
import { LogOut } from 'lucide-react';
import { GameHeader } from '@/components/GameHeader';
import { MatchIdDisplay } from '@/components/MatchIdDisplay';
import { SymbolDisplay } from '@/components/SymbolDisplay';
import { LobbyButtons } from '@/components/LobbyButtons';
import { GameBoard } from '@/components/GameBoard';
import { TurnStatus } from '@/components/TurnStatus';
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

  const stopSearchTimer = () => {
    if (searchTimerRef.current !== null) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  };

  // ── Init Nakama ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const newClient = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT);
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
        if (!name) {
          const userId = newSession.user_id
            ? newSession.user_id.substring(0, 5)
            : 'guest';
          const emojis = ['🤖', '👾', '🦄', '🐉', '👻', '🎃'];
          name =
            prompt('Welcome! Enter your display name:') || 'Player_' + userId;
          name = emojis[Math.floor(Math.random() * emojis.length)] + ' ' + name;

          localStorage.setItem('nakama_display_name', name);
        }
        setDisplayName(name);

        await newClient.updateAccount(newSession, { display_name: name });

        const newSocket = newClient.createSocket();
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

          const mySymbol = session?.user_id
            ? data.playerSymbols[session.user_id]
            : 'N/A';
          const opponentSymbol = data.opponentId
            ? data.playerSymbols[data.opponentId]
            : 'N/A';

          console.log(
            `My symbol: ${mySymbol}, Opponent symbol: ${opponentSymbol}`
          );
          console.log(
            `Current turn: ${data.currentTurn}, My user ID: ${session.user_id}`
          );

          const opponentId = Object.keys(data.playerSymbols).find(
            (id) => id !== session.user_id
          );

          console.log('Opponent ID:', opponentId);
          if (opponentId && data.displayNames) {
            console.log(
              'Opponent display name:',
              data.displayNames[opponentId]
            );
            setOpponentName(data.displayNames[opponentId]);
          }

          setStatus('Game on!');
          setStatus('Game on!');
          break;

        case OPCODE_GAME_STATE:
          console.log('Game state update:', data);
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);

          if (session?.user_id) {
            setStatus(
              data.currentTurn === session.user_id
                ? 'Your Turn'
                : "Opponent's Turn"
            );
          } else {
            setStatus('Game ongoing');
          }
          break;

        case OPCODE_GAME_OVER:
          setBoard(data.board);
          setWinner(data.winnerSymbol);
          setStatus('Game Over — Returning to lobby in 10...');
          stopSearchTimer();
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 9...'),
            1000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 8...'),
            2000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 7...'),
            3000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 6...'),
            4000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 5...'),
            5000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 4...'),
            6000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 3...'),
            7000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 2...'),
            8000
          );
          setTimeout(
            () => setStatus('Game Over — Returning to lobby in 1...'),
            9000
          );
          setTimeout(() => window.location.reload(), 10000);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_DRAW:
          setBoard(data.board);
          setIsDraw(true);
          setStatus('Draw! — Returning to lobby in 10...');
          stopSearchTimer();
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 9...'),
            1000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 8...'),
            2000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 7...'),
            3000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 6...'),
            4000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 5...'),
            5000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 4...'),
            6000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 3...'),
            7000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 2...'),
            8000
          );
          setTimeout(
            () => setStatus('Draw! — Returning to lobby in 1...'),
            9000
          );
          setTimeout(() => window.location.reload(), 10000);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_PARTNER_LEFT:
          setStatus('Opponent left — You Win! 🏆 Returning to lobby in 10...');
          setWinner('You Win');
          stopSearchTimer();
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 9...'
              ),
            1000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 8...'
              ),
            2000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 7...'
              ),
            3000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 6...'
              ),
            4000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 5...'
              ),
            5000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 4...'
              ),
            6000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 3...'
              ),
            7000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 2...'
              ),
            8000
          );
          setTimeout(
            () =>
              setStatus(
                'Opponent left — You Win! 🏆 Returning to lobby in 1...'
              ),
            9000
          );
          setTimeout(() => window.location.reload(), 10000);
          setTimeout(() => handleFetchStats(), 500);
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

        // Nakama matchmaker matched may provide match_id directly.
        // Fallback to token decode if available.
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

        setMatchId(joinedMatchId); // ✅ set BEFORE joining
        setMatchmakerTicket(null);
        stopSearchTimer();

        await socket.joinMatch(joinedMatchId);
      } catch (e) {
        console.error('Join matched error:', e);
        setStatus('Failed to join match');
        stopSearchTimer();
      }
    };
  }, [socket, session]);

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
      const ticket = await socket.addMatchmaker('*', 2, 2, {}, {});
      setMatchmakerTicket(ticket.ticket);

      let timer = 1;
      setStatus('Searching for opponent… 1');

      stopSearchTimer();
      searchTimerRef.current = window.setInterval(() => {
        timer += 1;
        setStatus(`Searching for opponent… ${timer}`);
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
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background text-foreground font-sans dark overflow-y-auto">
      {/* ── Left Panel: Game ── */}
      <div className="flex-1 flex flex-col items-center justify-start pt-8 md:pt-12 p-6 md:p-10 border-b md:border-b-0 md:border-r border-border overflow-y-auto min-h-0">
        <GameHeader displayName={displayName} status={status} />

        {matchId && <MatchIdDisplay matchId={matchId} />}

        {matchId && opponentName && (
          <p className="text-lg mt-2">
            Playing against: <strong>{opponentName}</strong>
          </p>
        )}

        <SymbolDisplay mySymbol={mySymbol} />

        {!matchId && !matchmakerTicket && (
          <LobbyButtons
            onCreateMatch={handleCreateMatch}
            onJoinMatch={handleJoinMatch}
            onFindMatch={handleFindMatch}
          />
        )}

        {!matchId && matchmakerTicket && (
          <div className="text-center">
            <p className="text-lg mb-4">{status}</p>
            <Button onClick={handleCancelSearch}>Cancel Search</Button>
          </div>
        )}

        {matchId && (
          <>
            <GameBoard
              board={board}
              isMyTurn={isMyTurn}
              winner={winner}
              isDraw={isDraw}
              onMakeMove={makeMove}
            />

            <TurnStatus
              winner={winner}
              isDraw={isDraw}
              isMyTurn={isMyTurn}
              currentTurn={currentTurn}
            />

            <Button
              variant="ghost"
              className="mt-10 text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-all shrink-0"
              onClick={handleLeaveGame}
            >
              <LogOut className="mr-2 size-4" />
              Leave Game
            </Button>
          </>
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
