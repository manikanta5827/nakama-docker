# API & WebSocket Opcodes

The system utilizes a combination of standard Nakama RPCs for data fetching and custom Opcodes for real-time WebSocket communication.

## 📡 WebSocket Opcodes
All real-time match data is exchanged using numeric opcodes to minimize bandwidth and ensure speed.

| Opcode | Name | Description |
| :--- | :--- | :--- |
| `1` | `MOVE` | Client sends move (e.g. `{"position": 4}`) to server. |
| `2` | `GAME_STATE` | Server broadcasts the updated board and next turn. |
| `3` | `GAME_OVER` | Server announces the winner and final board. |
| `4` | `START` | Server initializes the match with symbols (X/O). |
| `5` | `DRAW` | Server announces a draw (9 moves with no winner). |
| `6` | `PARTNER_LEFT` | Server notifies client that the opponent disconnected. |
| `8` | `TIMEOUT` | Server announces a win due to opponent turn timeout. |
| `9` | `TIMER_UPDATE` | Server sends real-time seconds remaining for the current turn. |

## 🛠️ RPC Functions
The following Remote Procedure Calls are registered on the backend:

- **`healthcheck`**: Simple endpoint to verify server status.
- **`create_match`**: Direct room creation for friend invites.
- **`get_stats`**: Fetches the current user's Win/Loss/Draw summary and recent match history.
- **`get_match_detail`**: Retrieves full move history and board state for a specific past match.
- **`get_leaderboard`**: Fetches the global ranking of players based on total wins.

## 📜 Matchmaking
The `matchmakerMatched` hook is used to automatically pair players who have joined the matchmaker pool, creating a dedicated authoritative match instance for them.
