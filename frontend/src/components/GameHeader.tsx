import { Badge } from "@/components/ui/badge";

interface GameHeaderProps {
  displayName: string | null;
  status: string;
}

export function GameHeader({ displayName, status }: GameHeaderProps) {
  return (
    <div className="flex items-center gap-6 mt-3 mb-10 shrink-0 md:mt-0">
      <div className="text-5xl font-black tracking-tighter text-primary select-none drop-shadow-sm">✕○</div>
      <div className="flex flex-col">
        {displayName && (
          <div className="text-lg font-bold tracking-tight mb-0.5">{displayName}</div>
        )}
        <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider font-bold opacity-80">
          {status}
        </Badge>
      </div>
    </div>
  );
}