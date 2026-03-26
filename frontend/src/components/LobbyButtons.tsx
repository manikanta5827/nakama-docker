import { Button } from "@/components/ui/button";

interface LobbyButtonsProps {
  onCreateMatch: () => void;
  onJoinMatch: () => void;
}

export function LobbyButtons({ onCreateMatch, onJoinMatch }: LobbyButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none sm:justify-center shrink-0">
      <Button
        size="lg"
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest h-14 px-10 shadow-lg"
        onClick={onCreateMatch}
      >
        Create Match
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="border-primary text-primary hover:bg-primary/10 font-bold uppercase tracking-widest h-14 px-10"
        onClick={onJoinMatch}
      >
        Join Match
      </Button>
    </div>
  );
}