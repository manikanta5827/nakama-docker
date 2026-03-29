# Architectural Decisions

This document outlines key engineering choices made during the development of the Tic-Tac-Toe server.

## 1. 3-Record Event-Based Storage
Nakama storage collections are optimized to balance data integrity, storage efficiency, and runtime performance.
- **Decision**: Every finished match creates three distinct records and updates an atomic summary.
- **Structure**:
    - **Global Detail**: A single heavy record (`match_detail_{id}`) containing move sequences and the final board state is saved under a system-owned `userId: null`. This is the single source of truth for replays.
    - **History Pointers**: Two lightweight metadata records (`match_h_{id}`) are saved—one for each player—containing only IDs, relative results, and timestamps for history listing.
    - **Atomic Summary**: A per-user `summary` record tracks total `[wins, losses, draws]`. This is updated using Nakama's **CAS (Compare-and-Swap)** versioning, ensuring accuracy even if multiple matches end simultaneously.
- **Rationale**: This separates "Heavy" replay data from "Light" history metadata. It eliminates data redundancy (moves aren't stored twice) and ensures the dashboard loads instantly by avoiding heavy JSON parsing until a user specifically requests a replay. Furthermore, names are resolved at runtime via `nk.usersGetId`, ensuring the history always displays current usernames.

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

## 7. Progressive Web App (PWA) Support
To provide a native-like experience:
- **Decision**: Implemented PWA using `vite-plugin-pwa` with custom caching strategies.
- **Implementation**:
  - **Offline Resilience**: Static assets (JS, CSS, HTML, Icons) are cached using Workbox's `generateSW` strategy.
  - **API Caching**: Nakama API calls are cached using a `NetworkFirst` strategy, allowing the app to display cached stats and match history even when the connection is unstable.
  - **Custom Install Flow**: A dedicated `InstallPrompt` component manages the `beforeinstallprompt` event, offering a custom UI for "Add to Home Screen" that is less intrusive than browser defaults.
  - **App-Like Experience**: Configured manifest with `display: standalone` to hide browser navigation bars and fixed orientation for consistent mobile gameplay.
