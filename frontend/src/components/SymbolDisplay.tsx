import { cn } from "@/lib/utils";

interface SymbolDisplayProps {
  mySymbol: string | null;
}

export function SymbolDisplay({ mySymbol }: SymbolDisplayProps) {
  if (!mySymbol) return null;

  return (
    <div className="flex items-center gap-2 text-sm mb-8 text-muted-foreground shrink-0">
      <span>You are playing as</span>
      <span className={cn(
        "font-black text-2xl",
        mySymbol === "X" ? "text-blue-500" : "text-red-500"
      )}>
        {mySymbol}
      </span>
    </div>
  );
}