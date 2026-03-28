# Deployment Details

The application is deployed using a distributed architecture to ensure scalability and proper port availability.

## Deployed URLs

- **GitHub Repository**: [https://github.com/manikanta5827/nakama-docker](https://github.com/manikanta5827/nakama-docker)
- **Frontend (Vercel)**: [https://nakama-docker-28ohfnz2x-manikantas-projects-05d5879c.vercel.app/](https://nakama-docker-28ohfnz2x-manikantas-projects-05d5879c.vercel.app/)
- **Backend (Nakama on Railway)**: [https://nakama.chilaka.online/](https://nakama.chilaka.online/)

## Platform Decisions

### Backend: Railway

Railway was chosen over other platforms (like Render) because it provides better support for custom ports (specifically `7350` and `7351`) required by Nakama.

1. **Dockerized Deployment**: The `Dockerfile` handles the multi-stage build of the TypeScript runtime.
2. **Postgres**: A managed PostgreSQL instance is linked to the Nakama service.
3. **SSL**: Terminated at the Railway edge, allowing secure `wss://` and `https://` communication.

### Frontend: Vercel

Vercel was chosen for the frontend to leverage its global Edge Network for fast static asset delivery of the React application.

## Configuration

Production environment variables used in `frontend/.env.production`:

```env
VITE_NAKAMA_HOST=nakama.chilaka.online
VITE_NAKAMA_PORT=443
VITE_NAKAMA_SSL=true
VITE_ENV=prod
```
