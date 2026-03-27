import { Button } from '@/components/ui/button';

interface LobbyButtonsProps {
  onCreateMatch: () => void;
  onJoinMatch: () => void;
  onFindMatch: () => void;
}

export function LobbyButtons({
  onCreateMatch,
  onJoinMatch,
  onFindMatch,
}: LobbyButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none sm:justify-center shrink-0">
      <Button
        size="lg"
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest h-14 px-10 shadow-lg"
        onClick={onCreateMatch}
      >
        Play with a Friend
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="border-primary text-primary hover:bg-primary/10 font-bold uppercase tracking-widest h-14 px-10"
        onClick={onJoinMatch}
      >
        Join Match
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest h-14 px-10 shadow-lg"
        onClick={onFindMatch}
      >
        Play Online with Anyone
      </Button>
    </div>
  );
}
