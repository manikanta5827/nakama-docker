# Deployment Details

This guide explains how to deploy the multiplayer Tic-Tac-Toe application to production. Since free-tier deployments often lack Docker Compose support, we separate the Backend and Database services.

## 1. Prepare Backend Image

Build and push the Dockerized TypeScript runtime image to your Docker Hub repository.

1. **Build and Push**:
   Replace `manikantathummuri519` with your Docker Hub username:
   ```bash
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     -t manikantathummuri519/nakama-tictactoe:latest \
     --push \
     .
   ```

## 2. Database Setup (e.g., Render)

Create a managed PostgreSQL instance to handle persistent storage for Nakama.

1. **Create Postgres Instance**: Use Render or any other PostgreSQL provider.
2. **Retrieve Connection String**: Copy the connection URL for use in the backend service.

## 3. Backend Deployment (e.g., Railway/Render)

Deploy the Dockerized Nakama service and connect it to the database.

1. **Create New Project**: Select "Docker Deployment" and provide your Hub image name (e.g., `manikantathummuri519/nakama-tictactoe:latest`).
2. **Environment Variables**: Add the following in the service settings:
   - `NAKAMA_DATABASE_ADDRESS`: Provide your Postgres connection string.
   - `NAKAMA_SERVER_KEY`: (Optional) Custom key for the Nakama server.
3. **Networking**: Ensure port **7350** is exposed/open in Railway settings to allow HTTP and WebSocket traffic.

## 4. Frontend Deployment (Vercel)

Deploy the React frontend as a Vite project and point it to your production backend.

1. **Upload Project**: Connect your repository to Vercel.
2. **Framework Preset**: Select "Vite".
3. **Environment Variables**:
   - `VITE_NAKAMA_HOST`: Your backend service URL (host only, e.g., `nakama.railway.app`).
   - `VITE_NAKAMA_PORT`: `443`
   - `VITE_NAKAMA_SSL`: `true`
   - `VITE_NAKAMA_SERVER_KEY`: Your configured server key (defaults to `defaultkey`).

## Deployed URLs

- **Frontend**: [https://lila-game.chilaka.online/](https://lila-game.chilaka.online/)
- **Backend (Nakama)**: [https://nakama.chilaka.online/](https://nakama.chilaka.online/)
