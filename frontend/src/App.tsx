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
import { type Board, type Summary, type MatchRecord } from "@/types";
import { resultColor, resultIcon, reasonLabel, timeAgo } from "@/lib/helper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Skull, 
  Handshake, 
  Pencil, 
  Clock, 
  BarChart2, 
  RefreshCw,
  LogOut,
  Hash
} from "lucide-react";

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
  const [summary,      setSummary]      = useState<Summary>({ wins: 0, losses: 0, draws: 0 });
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

        await fetchStats(newClient, newSession);

      } catch (e) {
        console.error("Init error:", e);
        setStatus("Connection Failed");
      }
    };

    init();
  }, []);

  const fetchStats = async (c?: Client, s?: Session) => {
    const activeClient  = c || client;
    const activeSession = s || session;
    if (!activeClient || !activeSession) return;

    setLoadingStats(true);
    try {
      const res = await activeClient.rpc(activeSession, "get_stats", {});
      let payload: { summary?: Summary; matchHistory?: MatchRecord[] } | null = null;

      if (typeof res.payload === "string") {
        payload = JSON.parse(res.payload);
      } else {
        payload = res.payload as { summary?: Summary; matchHistory?: MatchRecord[] };
      }

      setSummary(payload?.summary ?? { wins: 0, losses: 0, draws: 0 });
      setMatchHistory(payload?.matchHistory ?? []);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
      setSummary({ wins: 0, losses: 0, draws: 0 });
      setMatchHistory([]);
    } finally {
      setLoadingStats(false);
    }
  };

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
          setTimeout(() => fetchStats(), 500);
          break;

        case OPCODE_DRAW:
          setBoard(data.board);
          setIsDraw(true);
          setStatus("Draw!");
          setTimeout(() => fetchStats(), 500);
          break;

        case OPCODE_PARTNER_LEFT:
          setStatus("Opponent left — You Win! 🏆");
          setWinner(mySymbol);
          setTimeout(() => fetchStats(), 500);
          break;

        case OPCODE_SERVER_SHUTDOWN:
          setStatus("Server shutting down...");
          break;
      }
    };
  }, [socket, session, mySymbol]);

  const joinMatchById = async (id: string) => {
    if (!id || !socket) return;
    try {
      await socket.joinMatch(id);
      setMatchId(id);
      setStatus("Waiting for opponent...");
    } catch (e) {
      setStatus("Join failed");
    }
  };

  const createMatch = async () => {
    if (!client || !session || !socket) return;
    try {
      const res     = await client.rpc(session, "create_match", {});
      const payload = res.payload as { matchId: string };
      if (!payload?.matchId) throw new Error("No matchId in response");
      await joinMatchById(payload.matchId);
    } catch (e) {
      console.error("Create match error:", e);
    }
  };

  const joinMatch = async () => {
    const id = prompt("Enter Match ID:");
    if (!id) return;
    await joinMatchById(id);
  };

  const leaveGame = () => {
    window.location.reload();
  };

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
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background text-foreground font-sans dark overflow-hidden">

      {/* ── Left Panel: Game ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 border-b md:border-b-0 md:border-r border-border overflow-y-auto min-h-0">

        {/* Header */}
        <div className="flex items-center gap-6 mb-10 shrink-0">
          <div className="text-5xl font-black tracking-tighter text-primary select-none drop-shadow-sm">✕○</div>
          <div className="flex flex-col">
            {displayName && (
              <div className="text-lg font-bold tracking-tight mb-0.5">{displayName}</div>
            )}
            <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider font-bold opacity-80">
              {status}
            </Badge>
          </div>
        </div>

        {/* Match ID display */}
        {matchId && (
          <div className="flex flex-col items-center gap-1.5 mb-8 p-4 bg-muted/40 rounded-xl border border-border max-w-sm w-full shrink-0">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold">
              <Hash className="size-3" /> Match ID
            </div>
            <span className="text-xs text-primary font-mono font-medium uppercase tracking-wider break-all text-center">{matchId}</span>
          </div>
        )}

        {/* Symbol display */}
        {mySymbol && (
          <div className="flex items-center gap-2 text-sm mb-8 text-muted-foreground shrink-0">
            <span>You are playing as</span>
            <span className={cn(
              "font-black text-2xl",
              mySymbol === "X" ? "text-blue-500" : "text-red-500"
            )}>
              {mySymbol}
            </span>
          </div>
        )}

        {/* Lobby Buttons */}
        {!matchId && (
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none sm:justify-center shrink-0">
            <Button 
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest h-14 px-10 shadow-lg" 
              onClick={createMatch}
            >
              Create Match
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary text-primary hover:bg-primary/10 font-bold uppercase tracking-widest h-14 px-10" 
              onClick={joinMatch}
            >
              Join Match
            </Button>
          </div>
        )}

        {/* Board */}
        {matchId && (
          <>
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-2xl border border-border shadow-inner shrink-0">
              {board.map((cell, i) => (
                <button
                  key={i}
                  className={cn(
                    "w-20 h-20 sm:w-28 sm:h-28 border border-border rounded-xl flex items-center justify-center transition-all duration-200",
                    cell ? "bg-muted/50" : isMyTurn && !winner && !isDraw ? "bg-background hover:bg-muted cursor-pointer active:scale-95 hover:shadow-md" : "bg-muted/20 cursor-default"
                  )}
                  onClick={() => makeMove(i)}
                  disabled={!!cell || !isMyTurn || !!winner || isDraw}
                >
                  {cell && (
                    <span className={cn(
                      "text-4xl sm:text-5xl font-black leading-none select-none drop-shadow-sm animate-in zoom-in-50 duration-200",
                      cell === "X" ? "text-blue-500" : "text-red-500"
                    )}>
                      {cell}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Turn status */}
            <div className="mt-10 text-xl font-bold min-h-[40px] flex items-center justify-center shrink-0">
              {winner ? (
                <div className="flex items-center gap-2 text-green-500 animate-bounce">
                  <Trophy className="size-6" />
                  <span>{winner} Wins!</span>
                </div>
              ) : isDraw ? (
                <div className="flex items-center gap-2 text-yellow-500">
                  <Handshake className="size-6" />
                  <span>It's a Draw!</span>
                </div>
              ) : isMyTurn ? (
                <div className="flex items-center gap-2 text-primary animate-pulse">
                  <Pencil className="size-5" />
                  <span>Your Turn</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-5 animate-spin-slow" />
                  <span>Opponent's Turn...</span>
                </div>
              )}
            </div>

            <Button 
              variant="ghost" 
              className="mt-10 text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-all shrink-0" 
              onClick={leaveGame}
            >
              <LogOut className="mr-2 size-4" />
              Leave Game
            </Button>
          </>
        )}
      </div>

      {/* ── Right Panel: Stats ── */}
      <div className="w-full md:w-[380px] h-[40dvh] md:h-full flex flex-col p-6 md:p-8 bg-muted/10 overflow-y-auto border-l border-border shrink-0">

        <div className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-2 text-base font-bold tracking-tight uppercase">
            <BarChart2 className="size-5 text-primary" />
            <span>Your Stats</span>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full size-8 hover:bg-background"
            onClick={() => fetchStats()}
            disabled={loadingStats}
          >
            <RefreshCw className={cn("size-3.5", loadingStats && "animate-spin")} />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-10 shrink-0">
          <div className="flex flex-col p-4 bg-background rounded-xl border border-green-500/20 text-center shadow-sm">
            <span className="text-2xl font-black text-green-500">{summary?.wins ?? 0}</span>
            <span className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase font-bold">Wins</span>
          </div>
          <div className="flex flex-col p-4 bg-background rounded-xl border border-red-500/20 text-center shadow-sm">
            <span className="text-2xl font-black text-red-500">{summary?.losses ?? 0}</span>
            <span className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase font-bold">Losses</span>
          </div>
          <div className="flex flex-col p-4 bg-background rounded-xl border border-yellow-500/20 text-center shadow-sm">
            <span className="text-2xl font-black text-yellow-500">{summary?.draws ?? 0}</span>
            <span className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase font-bold">Draws</span>
          </div>
        </div>

        {/* Match History List */}
        <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4 font-bold px-1 shrink-0">Recent Matches</div>

        <div className="flex flex-col gap-3">
          {matchHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center italic opacity-60">
              <Pencil className="size-8 mb-2 opacity-20" />
              <span>No matches yet — go play!</span>
            </div>
          )}

          {matchHistory.map((match, i) => (
            <Card key={i} className="overflow-hidden border-none bg-background/50 hover:bg-background transition-colors shrink-0">
              <div className="flex justify-between items-start p-3.5 border-l-4" style={{ borderLeftColor: resultColor(match.result) }}>
                <div className="flex gap-3.5">
                  <div className="flex items-center justify-center size-9 rounded-full bg-muted/40 shrink-0 mt-0.5">
                    <span className="text-lg">
                      {resultIcon(match.result)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                      <span className="text-sm font-bold tracking-tight uppercase" style={{ color: resultColor(match.result) }}>
                        {match.result}
                      </span>
                      {match.reason && (
                        <span className="text-[9px] font-bold text-muted-foreground px-1.5 py-0.5 bg-muted/80 rounded uppercase tracking-tighter">
                          {reasonLabel(match.reason)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium opacity-70 truncate">
                      vs {match.opponent.substring(0, 16)}...
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground/50 font-bold tabular-nums shrink-0 ml-2 mt-1 uppercase tracking-tighter">
                  {timeAgo(match.timestamp)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
