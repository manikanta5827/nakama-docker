import { useState, useEffect, useCallback } from "react";
import { Client, Session, type Socket } from "@heroiclabs/nakama-js";
import { Button } from "@/components/ui/button";
import {
  NAKAMA_HOST,
  NAKAMA_PORT,
  NAKAMA_SERVER_KEY,
  OPCODE_MOVE,
  OPCODE_START,
  OPCODE_GAME_STATE,
  OPCODE_GAME_OVER,
  OPCODE_DRAW,
  OPCODE_PARTNER_LEFT,
  OPCODE_SERVER_SHUTDOWN,
} from "./constants";

type Board = (string | null)[];

function App() {
  const [client, setClient] = useState<Client | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Disconnected");
  const [winner, setWinner] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);

  // Initialize Nakama
  useEffect(() => {
    const initNakama = async () => {
      const newClient = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT);
      setClient(newClient);

      // Simple device authentication
      let deviceId = localStorage.getItem("nakama_device_id");
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem("nakama_device_id", deviceId);
      }

      try {
        const newSession = await newClient.authenticateDevice(deviceId, true);
        setSession(newSession);
        setStatus("Authenticated");

        const newSocket = newClient.createSocket();
        await newSocket.connect(newSession, true);
        setSocket(newSocket);
        setStatus("Connected & Ready");
      } catch (e) {
        console.error("Nakama Init Error:", e);
        setStatus("Connection Failed");
      }
    };

    initNakama();
  }, []);

  // Handle Match Data
  useEffect(() => {
    if (!socket || !session) return;

    socket.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      const data = JSON.parse(new TextDecoder().decode(matchData.data));

      console.log("Received opcode:", opCode, "data:", data);

      switch (opCode) {
        case OPCODE_START:
          setBoard(data.board);
          setMySymbol(session?.user_id ? data.playerSymbols[session.user_id] : null);
          setCurrentTurn(data.currentTurn);
          setStatus("Game Started");
          break;

        case OPCODE_GAME_STATE:
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);
          break;

        case OPCODE_GAME_OVER:
          setBoard(data.board);
          setWinner(data.winnerSymbol);
          setStatus("Game Over");
          break;

        case OPCODE_DRAW:
          setBoard(data.board);
          setIsDraw(true);
          setStatus("Draw");
          break;

        case OPCODE_PARTNER_LEFT:
          setStatus("Partner Left");
          break;

        case OPCODE_SERVER_SHUTDOWN:
          setStatus("Server Shutdown");
          break;
      }
    };
  }, [socket, session]);

  const createMatch = async () => {
    if (!client || !session || !socket) return;
    try {
      const rpcResponse = await client.rpc(session, "create_match", {});
      const payload = rpcResponse.payload;
      if (typeof payload !== 'string') {
        throw new Error('Invalid payload format');
      }
      const { matchId: newMatchId } = JSON.parse(payload);
      setMatchId(newMatchId);
      await socket.joinMatch(newMatchId);
      setStatus("Waiting for opponent...");
    } catch (e) {
      console.error("Create Match Error:", e);
    }
  };

  const joinMatch = async () => {
    const id = prompt("Enter Match ID:");
    if (!id || !socket) return;
    try {
      await socket.joinMatch(id);
      setMatchId(id);
      setStatus("Joining match...");
    } catch (e) {
      console.error("Join Match Error:", e);
    }
  };

  const makeMove = useCallback(
    (position: number) => {
      if (!socket || !matchId || board[position] || currentTurn !== session?.user_id || winner || isDraw) {
        return;
      }

      socket.sendMatchState(
        matchId,
        OPCODE_MOVE,
        JSON.stringify({ position })
      );
    },
    [socket, matchId, board, currentTurn, session?.user_id, winner, isDraw]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Nakama Tic-Tac-Toe</h1>
        <p className="text-muted-foreground">Status: {status}</p>
        {mySymbol && <p className="font-semibold mt-2">You are: {mySymbol}</p>}
        {matchId && (
          <div className="mt-2 p-2 bg-muted rounded text-xs break-all">
            Match ID: <span className="font-mono">{matchId}</span>
          </div>
        )}
      </div>

      {!matchId ? (
        <div className="space-x-4">
          <Button onClick={createMatch}>Create Match</Button>
          <Button variant="outline" onClick={joinMatch}>Join Match</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="grid grid-cols-3 gap-2 bg-muted p-2 rounded-lg">
            {board.map((cell, i) => (
              <button
                key={i}
                onClick={() => makeMove(i)}
                className="w-20 h-20 bg-background rounded-md text-3xl font-bold flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-100"
                disabled={!!cell || currentTurn !== session?.user_id || !!winner || isDraw}
              >
                <span className={cell === "X" ? "text-blue-500" : "text-red-500"}>
                  {cell}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 text-xl font-medium">
            {winner ? (
              <p className="text-green-500">Winner: {winner}!</p>
            ) : isDraw ? (
              <p className="text-yellow-500">It's a Draw!</p>
            ) : currentTurn === session?.user_id ? (
              <p className="animate-pulse">Your Turn</p>
            ) : (
              <p className="text-muted-foreground">Waiting for opponent...</p>
            )}
          </div>
          
          <Button 
            className="mt-8" 
            variant="ghost" 
            onClick={() => window.location.reload()}
          >
            Leave Game
          </Button>
        </div>
      )}
    </div>
  );
}

export default App;
