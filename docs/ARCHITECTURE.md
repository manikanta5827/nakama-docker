# Architectural Decisions

This document outlines key engineering choices made during the development of the Tic-Tac-Toe server.

## 1. Dual-Record Result Storage
Nakama storage collections for matches are structured to ensure high performance and easy retrieval on the frontend.
- **Decision**: For every finished match, two identical records are created—one under each player's `userId`.
- **Rationale**: Since Nakama's storage system is not a traditional relational database (SQL), querying for "all matches where I was a participant" (either as player 1 or player 2) would require complex filtering. By duplicating the record, each user's dashboard can simply query their own `match_*` collection keys to display their personal history and stats instantly.

## 2. Order Preservation in Matchmaking
To ensure fair role assignment (X vs O) during automatic pairing:
- **Decision**: The frontend sends a `start_time` string as a matchmaking property.
- **Implementation**: The Nakama backend receives this property and sorts the matched players by their click timestamps. The player with the earliest `start_time` is consistently assigned the 'X' symbol and the first turn. This prevents race conditions where both clients might think they are 'X'.

## 3. Server-Side Turn Timeouts
To prevent players from stalling matches:
- **Decision**: Implemented a 30-second turn limit enforced strictly by the backend.
- **Implementation**: The Nakama `matchLoop` runs at a fixed tick rate (5Hz). We track the tick number of the last valid move. If the difference between the current tick and the last move tick exceeds 150 (30 seconds / 0.2s per tick), the server automatically declares the other player as the winner. This protects the game against "cracked" or modified client timers.

## 4. Forfeit & Disconnection Logic
A match is never left "hanging."
- **Decision**: If a player leaves the match or hits a timeout, the server immediately grants a win to the remaining active player.
- **Persistence**: These edge cases are saved to the storage records and the global leaderboard just like a standard victory, ensuring the leaderboard remains accurate and reflects active participation.

## 6. Full Match Replays
To provide a competitive and educational experience:
- **Decision**: Store every individual move (player, position, and timestamp) within the final match record.
- **Implementation**: The frontend retrieves these move sequences via the `get_match_detail` RPC. Instead of just showing the final board, it uses a playback controller that iterates through the move array, rendering each symbol with a deliberate delay. This creates a "slow-motion" reconstruction of the entire match, allowing players to analyze their strategies.
