import { Hash, Clipboard } from "lucide-react";
import { useState } from "react";

interface MatchIdDisplayProps {
  matchId: string;
}

export function MatchIdDisplay({ matchId }: MatchIdDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(matchId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5 mb-8 p-4 bg-muted/40 rounded-xl border border-border max-w-sm w-full shrink-0">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold">
        <Hash className="size-3" /> Match ID
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-primary font-mono font-medium uppercase tracking-wider break-all text-center">{matchId}</span>
        <button
          onClick={copyToClipboard}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Copy to clipboard"
        >
          <Clipboard className="size-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      {copied && <span className="text-[10px] text-green-500">Copied!</span>}
    </div>
  );
}