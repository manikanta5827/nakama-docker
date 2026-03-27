import { Trophy, Medal, Award } from 'lucide-react';
import { type LeaderboardEntry } from '@/types';

interface RankingsListProps {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  currentUserId?: string;
}

export function RankingsList({
  leaderboard,
  loading,
  currentUserId,
}: RankingsListProps) {
  console.log(
    'Rendering RankingsList with leaderboard:',
    leaderboard,
    'loading:',
    loading,
    'currentUserId:',
    currentUserId
  );
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy className="size-8 mx-auto mb-2 opacity-50" />
        <p>No rankings yet</p>
        <p className="text-sm">Play some games to see the leaderboard!</p>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="size-4 text-yellow-500" />;
      case 2:
        return <Medal className="size-4 text-gray-400" />;
      case 3:
        return <Award className="size-4 text-amber-600" />;
      default:
        return (
          <span className="text-sm font-mono w-4 text-center">{rank}</span>
        );
    }
  };

  return (
    <div className="space-y-1">
      {leaderboard.map((entry) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            entry.userId === currentUserId
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center w-8">
            {getRankIcon(entry.rank)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{entry.username}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{entry.score}</p>
            <p className="text-xs text-muted-foreground">wins</p>
          </div>
        </div>
      ))}
    </div>
  );
}
