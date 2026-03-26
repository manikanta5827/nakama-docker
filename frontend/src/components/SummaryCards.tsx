import { type Summary } from "@/types";

interface SummaryCardsProps {
  summary: Summary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
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
  );
}