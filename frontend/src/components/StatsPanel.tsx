import { Button } from "@/components/ui/button";
import { BarChart2, RefreshCw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Summary, type MatchRecord, type LeaderboardEntry } from "@/types";
import { SummaryCards } from "./SummaryCards";
import { MatchHistory } from "./MatchHistory";
import { RankingsList } from "./RankingsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StatsPanelProps {
  summary: Summary;
  matchHistory: MatchRecord[];
  loadingStats: boolean;
  onRefreshStats: () => void;
  onMatchClick?: (match: MatchRecord) => void;
  leaderboard: LeaderboardEntry[];
  loadingLeaderboard: boolean;
  onRefreshLeaderboard: () => void;
  currentUserId?: string;
}

export function StatsPanel({
  summary,
  matchHistory,
  loadingStats,
  onRefreshStats,
  onMatchClick,
  leaderboard,
  loadingLeaderboard,
  onRefreshLeaderboard,
  currentUserId
}: StatsPanelProps) {
  return (
    <div className="w-full md:w-[380px] h-[40dvh] md:h-full flex flex-col p-6 md:p-8 bg-muted/10 overflow-y-auto border-l border-border shrink-0">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex items-center gap-2 text-base font-bold tracking-tight uppercase">
          <BarChart2 className="size-5 text-primary" />
          <span>Stats & Rankings</span>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full size-8 hover:bg-background"
          onClick={() => {
            onRefreshStats();
            onRefreshLeaderboard();
          }}
          disabled={loadingStats || loadingLeaderboard}
        >
          <RefreshCw className={cn("size-3.5", (loadingStats || loadingLeaderboard) && "animate-spin")} />
        </Button>
      </div>

      <Tabs defaultValue="stats" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 mb-6 shrink-0">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart2 className="size-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="rankings" className="flex items-center gap-2">
            <Trophy className="size-4" />
            Rankings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="flex-1 min-h-0 space-y-6">
          <SummaryCards summary={summary} />

          <div className="space-y-4">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4 font-bold px-1 shrink-0">Recent Matches</div>
            <MatchHistory matchHistory={matchHistory} onMatchClick={onMatchClick} />
          </div>
        </TabsContent>

        <TabsContent value="rankings" className="flex-1 min-h-0">
          <RankingsList
            leaderboard={leaderboard}
            loading={loadingLeaderboard}
            currentUserId={currentUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}