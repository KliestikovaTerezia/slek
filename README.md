# Shello

Real-time chat app built for VPWA at FIIT STU.

- `client/` – Quasar (Vue 3) SPA
- `server/` – AdonisJS 5 API + socket.io

## Run locally

```bash
cd server
cp .env.example .env
npm install
node ace migration:run
npm run dev
```

```bash
cd client
npm install
npm run dev
```

The client talks to `http://localhost:3333` in dev. In production it uses the `API_URL` set at build time.

## Deploy (free)

- Database: [Neon](https://neon.tech) free Postgres
- Server and client: [Render](https://render.com), using the `render.yaml` Blueprint in this repo

1. Create a Neon project and copy its connection string.
2. In Render, choose **New → Blueprint** and pick this repo.
3. Set `DATABASE_URL` (shello-api) to the Neon connection string.
4. Set `API_URL` (shello) to the server's URL, e.g. `https://shello-api.onrender.com`.

Migrations run automatically each time the server starts. The free server sleeps after 15 minutes without traffic, so the first request after that takes about a minute.
