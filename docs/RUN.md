# Local Development Guide

## Prerequisites
- **Docker Desktop**: For running Nakama and PostgreSQL.
- **Node.js (v18+)**: For the React frontend.

## 1. Start Backend (Nakama)
Run the following command in the root directory:
```bash
docker compose up --build
```
- Nakama Console: `http://localhost:7351` (Login: `admin` / `password`)
- API Endpoint: `http://localhost:7350`

## 2. Start Frontend
Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm install
npm run dev
```
- Local URL: `http://localhost:5173`

## 3. Environment Configuration
Ensure your `frontend/.env` contains:
```env
VITE_NAKAMA_HOST=localhost
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
```
