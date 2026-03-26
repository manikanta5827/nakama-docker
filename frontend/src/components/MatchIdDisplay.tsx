import { Hash } from "lucide-react";

interface MatchIdDisplayProps {
  matchId: string;
}

export function MatchIdDisplay({ matchId }: MatchIdDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 mb-8 p-4 bg-muted/40 rounded-xl border border-border max-w-sm w-full shrink-0">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold">
        <Hash className="size-3" /> Match ID
      </div>
      <span className="text-xs text-primary font-mono font-medium uppercase tracking-wider break-all text-center">{matchId}</span>
    </div>
  );
}