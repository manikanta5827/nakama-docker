import { Trophy, Handshake, Pencil, Clock } from "lucide-react";

interface TurnStatusProps {
  winner: string | null;
  isDraw: boolean;
  isMyTurn: boolean;
}

export function TurnStatus({ winner, isDraw, isMyTurn }: TurnStatusProps) {
  return (
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
  );
}