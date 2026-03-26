import { Button } from "@/components/ui/button";
import { BarChart2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Summary, type MatchRecord } from "@/types";
import { SummaryCards } from "./SummaryCards";
import { MatchHistory } from "./MatchHistory";

interface StatsPanelProps {
  summary: Summary;
  matchHistory: MatchRecord[];
  loadingStats: boolean;
  onRefreshStats: () => void;
}

export function StatsPanel({ summary, matchHistory, loadingStats, onRefreshStats }: StatsPanelProps) {
  return (
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
          onClick={onRefreshStats}
          disabled={loadingStats}
        >
          <RefreshCw className={cn("size-3.5", loadingStats && "animate-spin")} />
        </Button>
      </div>

      <SummaryCards summary={summary} />

      <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4 font-bold px-1 shrink-0">Recent Matches</div>

      <MatchHistory matchHistory={matchHistory} />
    </div>
  );
}