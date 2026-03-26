import { Client, Session } from "@heroiclabs/nakama-js";
import type {Socket} from "@heroiclabs/nakama-js";
import { type Summary, type MatchRecord } from "@/types";

export function resultColor(result: string) {
  if (result === "win")  return "#4ade80";
  if (result === "loss") return "#f87171";
  return "#facc15";
}

export function resultIcon(result: string) {
  if (result === "win")  return "🏆";
  if (result === "loss") return "💀";
  return "🤝";
}

export function reasonLabel(reason: string) {
  if (reason === "normal")       return "Fair game";
  if (reason === "partner_left") return "Opponent left";
  if (reason === "timeout")      return "Opponent timeout";
  return "";
}

export function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Game Logic Helpers ──────────────────────────────────────
export const fetchStats = async (
  client: Client | null,
  session: Session | null,
  setSummary: (summary: Summary) => void,
  setMatchHistory: (history: MatchRecord[]) => void,
  setLoadingStats: (loading: boolean) => void
) => {
  if (!client || !session) return;

  setLoadingStats(true);
  try {
    const res = await client.rpc(session, "get_stats", {});
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

export const joinMatchById = async (
  id: string,
  socket: Socket | null,
  setMatchId: (id: string | null) => void,
  setStatus: (status: string) => void
) => {
  if (!id || !socket) return;
  try {
    await socket.joinMatch(id);
    setMatchId(id);
    setStatus("Waiting for opponent...");
  } catch (e) {
    setStatus("Join failed");
  }
};

export const createMatch = async (
  client: Client | null,
  session: Session | null,
  socket: Socket | null,
  joinMatchById: (id: string) => void
) => {
  if (!client || !session || !socket) return;
  try {
    const res = await client.rpc(session, "create_match", {});
    const payload = res.payload as { matchId: string };
    if (!payload?.matchId) throw new Error("No matchId in response");
    await joinMatchById(payload.matchId);
  } catch (e) {
    console.error("Create match error:", e);
  }
};

export const joinMatch = async (joinMatchById: (id: string) => void) => {
  const id = prompt("Enter Match ID:");
  if (!id) return;
  await joinMatchById(id);
};

export const leaveGame = () => {
  window.location.reload();
};