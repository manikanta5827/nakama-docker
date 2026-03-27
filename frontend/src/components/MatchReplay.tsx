import { useState, useEffect } from "react";
import { type Board, type MatchDetail, type Move } from "@/types";
import { GameBoard } from "./GameBoard";

interface MatchReplayProps {
  matchDetail: MatchDetail;
  onClose: () => void;
}

export function MatchReplay({ matchDetail, onClose }: MatchReplayProps) {
  const [replayBoard, setReplayBoard] = useState<Board>(Array(9).fill(null));
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const replayMoves = (moves: Move[]) => {
    setReplayBoard(Array(9).fill(null));
    setCurrentMoveIndex(-1);
    setIsPlaying(true);

    moves.forEach((move, index) => {
      setTimeout(() => {
        setReplayBoard(prev => {
          const next = [...prev];
          next[move.position] = move.symbol;
          return next;
        });
        setCurrentMoveIndex(index);
      }, index * 800);  // 800ms between each move
    });

    setTimeout(() => {
      setIsPlaying(false);
    }, moves.length * 800);
  };

  useEffect(() => {
    if (matchDetail.moves.length > 0) {
      replayMoves(matchDetail.moves);
    }
  }, [matchDetail]);

  const handleRestart = () => {
    replayMoves(matchDetail.moves);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Match Replay</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          <p>Result: {matchDetail.result}</p>
          <p>Opponent: {matchDetail.opponent}</p>
          <p>Moves: {currentMoveIndex + 1} / {matchDetail.moves.length}</p>
        </div>

        <GameBoard
          board={replayBoard}
          isMyTurn={false}
          winner={null}
          isDraw={false}
          onMakeMove={() => {}} // No moves in replay
        />

        <div className="flex justify-center mt-4">
          <button
            onClick={handleRestart}
            disabled={isPlaying}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isPlaying ? "Replaying..." : "Restart Replay"}
          </button>
        </div>
      </div>
    </div>
  );
}