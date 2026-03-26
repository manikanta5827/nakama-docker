import { useState, useEffect, useCallback } from "react";
import { Client, Session, type Socket } from "@heroiclabs/nakama-js";
import { OPCODE_MOVE, OPCODE_GAME_STATE, OPCODE_GAME_OVER, OPCODE_START, OPCODE_DRAW, OPCODE_PARTNER_LEFT, OPCODE_SERVER_SHUTDOWN, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SERVER_KEY } from "./constants";
import { type Board, type Summary, type MatchRecord } from "./types";
import { resultColor, resultIcon, reasonLabel, timeAgo } from "./lib/helper";
import { styles } from "./lib/styles";

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

      // Stable device ID using proper UUID
      let deviceId = localStorage.getItem("nakama_device_id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("nakama_device_id", deviceId);
      }

      try {
        const newSession = await newClient.authenticateDevice(deviceId, true);
        setSession(newSession);

        // Store the real Nakama UUID — this is what shows in dashboard
        if (newSession.user_id) {
          localStorage.setItem("nakama_user_id", newSession.user_id);
        }

        // Ask for display name once — save it forever
        let name = localStorage.getItem("nakama_display_name");
        if (!name) {
          const userId = newSession.user_id ? newSession.user_id.substring(0, 5) : "guest";
          name = prompt("Welcome! Enter your display name:") || "Player_" + userId;
          localStorage.setItem("nakama_display_name", name);
        }
        setDisplayName(name);

        // Push display name into Nakama profile — shows in dashboard
        await newClient.updateAccount(newSession, { display_name: name });

        const newSocket = newClient.createSocket();
        await newSocket.connect(newSession, true);
        setSocket(newSocket);
        setStatus("Ready to play");

        // Load stats right after connecting
        await fetchStats(newClient, newSession);

      } catch (e) {
        console.error("Init error:", e);
        setStatus("Connection Failed");
      }
    };

    init();
  }, []);

  // ── Fetch Stats from Server ──────────────────────────────
  const fetchStats = async (c?: Client, s?: Session) => {
    const activeClient  = c || client;
    const activeSession = s || session;
    if (!activeClient || !activeSession) return;

    setLoadingStats(true);
    try {
      const res = await activeClient.rpc(activeSession, "get_stats", {});
      let payload: { summary?: Summary; matchHistory?: MatchRecord[] } | null = null;

      console.log("RPC response payload:", res.payload);
      
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

  // ── Handle All Incoming Match Opcodes ───────────────────
  useEffect(() => {
    if (!socket || !session) return;

    socket.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      const data   = JSON.parse(new TextDecoder().decode(matchData.data));
      console.log("Opcode:", opCode, "Data:", data);

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
          // Refresh stats after match ends
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

  // ── Match Actions ────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* ── Left Panel: Game ── */}
      <div style={styles.gamePanel}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>✕ ○</div>
          <div>
            {displayName && (
              <div style={styles.playerName}>👤 {displayName}</div>
            )}
            <div style={styles.statusBadge}>{status}</div>
          </div>
        </div>

        {/* Match ID display */}
        {matchId && (
          <div style={styles.matchIdBox}>
            <span style={styles.matchIdLabel}>MATCH ID</span>
            <span style={styles.matchIdValue}>{matchId}</span>
          </div>
        )}

        {/* Symbol display */}
        {mySymbol && (
          <div style={styles.symbolBox}>
            You are{" "}
            <span style={{
              color: mySymbol === "X" ? "#60a5fa" : "#f87171",
              fontWeight: 800,
              fontSize: 22
            }}>
              {mySymbol}
            </span>
          </div>
        )}

        {/* Lobby Buttons */}
        {!matchId && (
          <div style={styles.lobbyButtons}>
            <button style={styles.btnPrimary} onClick={createMatch}>
              Create Match
            </button>
            <button style={styles.btnSecondary} onClick={joinMatch}>
              Join Match
            </button>
          </div>
        )}

        {/* Board */}
        {matchId && (
          <>
            <div style={styles.board}>
              {board.map((cell, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.cell,
                    cursor: (!cell && isMyTurn && !winner && !isDraw)
                      ? "pointer" : "default",
                    background: cell
                      ? "rgba(255,255,255,0.06)"
                      : isMyTurn && !winner && !isDraw
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.02)",
                  }}
                  onClick={() => makeMove(i)}
                  disabled={!!cell || !isMyTurn || !!winner || isDraw}
                >
                  {cell && (
                    <span style={{
                      color: cell === "X" ? "#60a5fa" : "#f87171",
                      fontSize: 40,
                      fontWeight: 900,
                      lineHeight: 1
                    }}>
                      {cell}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Turn status */}
            <div style={styles.turnStatus}>
              {winner ? (
                <span style={{ color: "#4ade80" }}>🏆 {winner} Wins!</span>
              ) : isDraw ? (
                <span style={{ color: "#facc15" }}>🤝 It's a Draw!</span>
              ) : isMyTurn ? (
                <span style={{ color: "#a78bfa", animation: "pulse 1.5s infinite" }}>
                  ✏️ Your Turn
                </span>
              ) : (
                <span style={{ color: "#6b7280" }}>⏳ Opponent's Turn...</span>
              )}
            </div>

            <button style={styles.btnGhost} onClick={leaveGame}>
              Leave Game
            </button>
          </>
        )}
      </div>

      {/* ── Right Panel: Stats ── */}
      <div style={styles.statsPanel}>

        <div style={styles.statsHeader}>
          <span>📊 Your Stats</span>
          <button
            style={styles.refreshBtn}
            onClick={() => fetchStats()}
            disabled={loadingStats}
          >
            {loadingStats ? "..." : "↻"}
          </button>
        </div>

        {/* Summary Cards */}
        <div style={styles.summaryRow}>
          <div style={{ ...styles.summaryCard, borderColor: "#4ade80" }}>
            <div style={{ ...styles.summaryNum, color: "#4ade80" }}>{summary?.wins ?? 0}</div>
            <div style={styles.summaryLabel}>Wins</div>
          </div>
          <div style={{ ...styles.summaryCard, borderColor: "#f87171" }}>
            <div style={{ ...styles.summaryNum, color: "#f87171" }}>{summary?.losses ?? 0}</div>
            <div style={styles.summaryLabel}>Losses</div>
          </div>
          <div style={{ ...styles.summaryCard, borderColor: "#facc15" }}>
            <div style={{ ...styles.summaryNum, color: "#facc15" }}>{summary?.draws ?? 0}</div>
            <div style={styles.summaryLabel}>Draws</div>
          </div>
        </div>

        {/* Match History List */}
        <div style={styles.historyLabel}>Recent Matches</div>

        <div style={styles.historyList}>
          {matchHistory.length === 0 && (
            <div style={styles.emptyHistory}>
              No matches yet — go play! 🎮
            </div>
          )}

          {matchHistory.map((match, i) => (
            <div key={i} style={{
              ...styles.historyRow,
              borderLeft: `3px solid ${resultColor(match.result)}`
            }}>
              <div style={styles.historyLeft}>
                <span style={styles.historyIcon}>
                  {resultIcon(match.result)}
                </span>
                <div>
                  <div style={{
                    ...styles.historyResult,
                    color: resultColor(match.result)
                  }}>
                    {match.result.toUpperCase()}
                    {match.reason && (
                      <span style={styles.historyReason}>
                        {" "}· {reasonLabel(match.reason)}
                      </span>
                    )}
                  </div>
                  <div style={styles.historyOpponent}>
                    vs {match.opponent.substring(0, 8)}...
                  </div>
                </div>
              </div>
              <div style={styles.historyTime}>
                {timeAgo(match.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
