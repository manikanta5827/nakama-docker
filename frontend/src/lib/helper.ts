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