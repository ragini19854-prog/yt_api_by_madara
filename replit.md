# Madara Music

A full-stack YouTube music streaming app — search, stream, and save music from YouTube with no API key. Includes playlists, favorites, play history, a persistent player, and Clerk Google auth.

## Run & Operate

- `pnpm --filter @workspace/madara-music run dev` — run the React/Vite frontend (port 5173, BASE_PATH=/)
- `pnpm --filter @workspace/api-server run dev` — run the Express API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Environment Variables

- `DATABASE_URL` — Postgres connection string (for playlists, favorites, history, API keys)
- `CLERK_PUBLISHABLE_KEY` — Clerk auth publishable key
- `CLERK_SECRET_KEY` — Clerk auth secret key
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk key for the frontend
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL for the frontend
- `SESSION_SECRET` — session secret

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 18 + Vite 7, Tailwind CSS, Wouter (routing), TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (Google OAuth)
- YouTube: `youtubei.js` Innertube API (no API key required)
- Build: esbuild (CJS bundle)

## Where Things Live

- `artifacts/madara-music/src/` — React frontend
  - `contexts/PlayerContext.tsx` — core player logic, YouTube IFrame API, autoplay
  - `pages/` — Home, Search, Library, Bot, API Keys, Profile, Settings
  - `components/layout/Sidebar.tsx` — navigation sidebar
  - `components/player/` — MiniPlayer and FullPlayer
- `artifacts/api-server/src/` — Express backend
  - `routes/youtube.ts` — YouTube search, stream, download, **related tracks**
  - `routes/api-keys.ts` — user API key generation/management
  - `routes/playlists.ts`, `favorites.ts`, `history.ts` — CRUD endpoints
- `lib/db/src/schema/` — Drizzle ORM schema (favorites, history, playlists, api-keys)

## Key Features

- **Autoplay** — uses `/api/music/youtube/related` (YouTube's own recommendations) to queue fresh related tracks; never replays already-queued songs
- **API Keys page** — users can generate, copy, and revoke personal API keys at `/api-keys`
- **Bot templates** — `/bot` page shows Discord, Telegram, Telegram VC, and 100-bot manager code with autoplay support baked in
- **yt-dlp "Sign in" fix** — API server now tries IOS → TV_EMBEDDED → ANDROID → MWEB → WEB clients in order, which reliably bypasses the sign-in wall without cookies

## Architecture Decisions

- `youtubei.js` Innertube API is used instead of `yt-dlp` to avoid the "Sign in to confirm" error — it uses YouTube's native app clients
- The IOS client is tried first for audio URL resolution as it is the most reliable at bypassing bot-detection
- API keys are stored in Postgres and masked (only first 12 + last 4 chars shown after creation)
- Related tracks use the `watch_next_feed` from Innertube's `getInfo` response, giving YouTube's real "Up Next" recommendations
- Autoplay filters already-queued track IDs so the same song is never repeated in a session

## User Preferences

_Populate as you build._

## Gotchas

- Both `PORT` and `BASE_PATH` env vars must be set before running — the dev workflow commands include these
- DB schema must be pushed with `pnpm --filter @workspace/db run push` before favorites/playlists/history/API keys work
- Clerk requires both a publishable key and a secret key; the frontend uses `VITE_CLERK_PUBLISHABLE_KEY`
