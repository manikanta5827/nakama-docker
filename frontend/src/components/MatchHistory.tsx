import { Card } from "@/components/ui/card";
import { Pencil } from "lucide-react";
import { type MatchRecord } from "@/types";
import { resultColor, resultIcon, reasonLabel, timeAgo } from "@/lib/helper";

interface MatchHistoryProps {
  matchHistory: MatchRecord[];
}

export function MatchHistory({ matchHistory }: MatchHistoryProps) {
  return (
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
  );
}