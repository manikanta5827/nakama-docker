import { cn } from '@/lib/utils';
import { type Board } from '@/types';

interface GameBoardProps {
  board: Board;
  isMyTurn: boolean;
  winner: string | null;
  isDraw: boolean;
  onMakeMove: (position: number) => void;
}

export function GameBoard({
  board,
  isMyTurn,
  winner,
  isDraw,
  onMakeMove,
}: GameBoardProps) {
  const playMoveSound = () => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 380;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 200);
    } catch (error) {
      // ignore audio errors, best-effort effect
      console.warn('Move sound failed', error);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-2xl border border-border shadow-inner shrink-0">
      {board.map((cell, i) => (
        <button
          key={i}
          className={cn(
            'w-20 h-20 sm:w-28 sm:h-28 border border-border rounded-xl flex items-center justify-center transition-all duration-200',
            cell
              ? 'bg-muted/50'
              : isMyTurn && !winner && !isDraw
                ? 'bg-background hover:bg-muted cursor-pointer active:scale-95 hover:shadow-md'
                : 'bg-muted/20 cursor-default'
          )}
          onClick={() => {
            if (cell || !isMyTurn || winner || isDraw) return;
            playMoveSound();
            onMakeMove(i);
          }}
          disabled={!!cell || !isMyTurn || !!winner || isDraw}
        >
          {cell && (
            <span
              className={cn(
                'text-4xl sm:text-5xl font-black leading-none select-none drop-shadow-sm animate-in zoom-in-50 duration-200',
                cell === 'X' ? 'text-blue-500' : 'text-red-500'
              )}
            >
              {cell}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
