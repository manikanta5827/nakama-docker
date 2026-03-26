import { useState, useEffect, useCallback } from "react";
import { Client, Session, type Socket } from "@heroiclabs/nakama-js";
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
  NAKAMA_SERVER_KEY 
} from "@/constants";
import { type Board, type MatchRecord } from "@/types";
import { fetchStats, joinMatchById, createMatch, joinMatch, leaveGame } from "@/lib/helper";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { MatchIdDisplay } from "@/components/MatchIdDisplay";
import { SymbolDisplay } from "@/components/SymbolDisplay";
import { LobbyButtons } from "@/components/LobbyButtons";
import { GameBoard } from "@/components/GameBoard";
import { TurnStatus } from "@/components/TurnStatus";
import { StatsPanel } from "@/components/StatsPanel";

// ── Main Component ─────────────────────────────────────────
export default function App() {
  const [client,       setClient]       = useState<Client | null>(null);
  const [session,      setSession]      = useState<Session | null>(null);
  const [socket,       setSocket]       = useState<Socket | null>(null);
  const [matchId,      setMatchId]      = useState<string | null>(null);
  const [board,        setBoard]        = useState<Board>(Array(9).fill(null));
  const [mySymbol,     setMySymbol]     = useState<string | null>(null);
  const [currentTurn,  setCurrentTurn]  = useState<string | null>(null);
  const [status,       setStatus]       = useState("Connecting...");
  const [winner,       setWinner]       = useState<string | null>(null);
  const [isDraw,       setIsDraw]       = useState(false);
  const [displayName,  setDisplayName]  = useState<string | null>(null);
  const [summary,      setSummary]      = useState({ wins: 0, losses: 0, draws: 0 });
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Init Nakama ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const newClient = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT);
      setClient(newClient);

      let deviceId = localStorage.getItem("nakama_device_id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("nakama_device_id", deviceId);
      }

      try {
        const newSession = await newClient.authenticateDevice(deviceId, true);
        setSession(newSession);

        if (newSession.user_id) {
          localStorage.setItem("nakama_user_id", newSession.user_id);
        }

        let name = localStorage.getItem("nakama_display_name");
        if (!name) {
          const userId = newSession.user_id ? newSession.user_id.substring(0, 5) : "guest";
          const emojis = ["🤖", "👾", "🦄", "🐉", "👻", "🎃"];
          name = prompt("Welcome! Enter your display name:") || "Player_" + userId;
          name = emojis[Math.floor(Math.random() * emojis.length)] + " " + name;

          localStorage.setItem("nakama_display_name", name);
        }
        setDisplayName(name);

        await newClient.updateAccount(newSession, { display_name: name });

        const newSocket = newClient.createSocket();
        await newSocket.connect(newSession, true);
        setSocket(newSocket);
        setStatus("Ready to play");

        await fetchStats(newClient, newSession, setSummary, setMatchHistory, setLoadingStats);

      } catch (e) {
        console.error("Init error:", e);
        setStatus("Connection Failed");
      }
    };

    init();
  }, []);

  // ── Fetch Stats from Server ──────────────────────────────
  const handleFetchStats = useCallback(() => {
    fetchStats(client, session, setSummary, setMatchHistory, setLoadingStats);
  }, [client, session]);

  useEffect(() => {
    if (!socket || !session) return;

    socket.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      const data   = JSON.parse(new TextDecoder().decode(matchData.data));

      switch (opCode) {
        case OPCODE_START:
          setBoard(data.board);
          setMySymbol(session.user_id ? data.playerSymbols[session.user_id] : null);
          setCurrentTurn(data.currentTurn);
          setStatus("Game on!");
          break;

        case OPCODE_GAME_STATE:
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);
          break;

        case OPCODE_GAME_OVER:
          setBoard(data.board);
          setWinner(data.winnerSymbol);
          setStatus("Game Over");
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_DRAW:
          setBoard(data.board);
          setIsDraw(true);
          setStatus("Draw!");
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_PARTNER_LEFT:
          setStatus("Opponent left — You Win! 🏆");
          setWinner(mySymbol);
          setTimeout(() => handleFetchStats(), 500);
          break;

        case OPCODE_SERVER_SHUTDOWN:
          setStatus("Server shutting down...");
          break;
      }
    };
  }, [socket, session, mySymbol]);

  // ── Match Actions ────────────────────────────────────────
  const handleJoinMatchById = useCallback((id: string) => {
    joinMatchById(id, socket, setMatchId, setStatus);
  }, [socket]);

  const handleCreateMatch = useCallback(() => {
    createMatch(client, session, socket, handleJoinMatchById);
  }, [client, session, socket, handleJoinMatchById]);

  const handleJoinMatch = useCallback(() => {
    joinMatch(handleJoinMatchById);
  }, [handleJoinMatchById]);

  const handleLeaveGame = useCallback(() => {
    leaveGame();
  }, []);

  const makeMove = useCallback((position: number) => {
    if (
      !socket || !matchId ||
      board[position] ||
      currentTurn !== session?.user_id ||
      winner || isDraw
    ) return;

    socket.sendMatchState(matchId, OPCODE_MOVE, JSON.stringify({ position }));
  }, [socket, matchId, board, currentTurn, session?.user_id, winner, isDraw]);

  const isMyTurn = currentTurn === session?.user_id;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background text-foreground font-sans dark overflow-y-auto">

      {/* ── Left Panel: Game ── */}
      <div className="flex-1 flex flex-col items-center justify-start pt-8 md:pt-12 p-6 md:p-10 border-b md:border-b-0 md:border-r border-border overflow-y-auto min-h-0">

        <GameHeader displayName={displayName} status={status} />

        {matchId && <MatchIdDisplay matchId={matchId} />}

        <SymbolDisplay mySymbol={mySymbol} />

        {!matchId && (
          <LobbyButtons onCreateMatch={handleCreateMatch} onJoinMatch={handleJoinMatch} />
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

            <TurnStatus winner={winner} isDraw={isDraw} isMyTurn={isMyTurn} />

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
      />
    </div>
  );
}
