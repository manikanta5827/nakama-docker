# Local Development Guide

This guide explains how to set up and run the entire Tic-Tac-Toe stack locally using Docker for the backend and Node.js for the frontend.

## Prerequisites

- **Docker Desktop**: Ensure `docker compose` is installed and running.
- **Node.js (v18+)**: For the React frontend.
- **jq**: Optional, for formatted log filtering.

## 1. Start Backend (Nakama & Postgres)

The backend runs in Docker to ensure a consistent environment.

1. **Verify Docker Compose**:
   ```bash
   docker compose version
   ```

2. **Build and Start**:
   Run this in the root directory to start the services in the background:
   ```bash
   docker compose up --build -d
   ```

3. **Monitor Application Logs**:
   To see only the game-specific logic logs (ignoring system noise), use this filtered command:
   ```bash
   docker compose logs -f nakama --no-log-prefix | jq -R 'fromjson? | select(.caller=="server/runtime_javascript_logger.go:76")'
   ```

- **Nakama Console**: [http://localhost:7351](http://localhost:7351) (Login: `admin` / `password`)
- **API Endpoint**: `http://localhost:7350`
- **Database**: Managed automatically; check records via the Nakama Console under the "Storage" tab.

## 2. Start Frontend

1. **Navigate and Install**:
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**:
   Ensure `frontend/.env` contains:
   ```env
   VITE_NAKAMA_HOST=localhost
   VITE_NAKAMA_PORT=7350
   VITE_NAKAMA_SSL=false
   VITE_NAKAMA_SERVER_KEY=defaultkey
   ```

3. **Run Dev Server**:
   ```bash
   npm run dev
   ```

- **Frontend URL**: [http://localhost:5173](http://localhost:5173)

## 3. Testing PWA Locally

1. **Install Prompt**: The custom "Add to Home Screen" prompt will appear after the first few interactions if the browser conditions are met.
2. **Offline Mode**: Use Chrome DevTools (Network tab -> Throttling -> Offline). The UI and recent history will still be accessible via the cache.
3. **Standalone Mode**: Use the browser's "Install" option to test the native-like experience.
