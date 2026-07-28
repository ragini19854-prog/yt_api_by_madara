<div align="center">

<img src="https://img.shields.io/badge/MADARA-MUSIC-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Madara Music" height="60"/>

# 🎵 Madara Music

### Full-stack YouTube music streaming app — no API key, no limits.

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791?style=flat-square&logo=postgresql)](https://orm.drizzle.team)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk)](https://clerk.com)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)

<br/>

> Stream any song on YouTube directly in your browser — with playlists, favorites, history, a full-featured player, and Google login. Zero YouTube API key required.

<br/>

![App Preview](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)

</div>

---

## ✨ Features

### 🎧 Player
- **YouTube IFrame Player API** — plays full songs in the background, no server streaming needed
- Persistent mini-player across all pages
- Full-player view with seek bar, volume control, and animated equalizer
- **Shuffle**, **Repeat One / All**, **Autoplay** (auto-queues related tracks)
- Queue management — add to queue, skip forward/back
- **Lyrics tab** inside the full player

### 🔍 Search & Discovery
- YouTube music search powered by `youtubei.js` (Innertube API) — **no API key needed**
- Trending tracks homepage
- Genre-based browsing: Lo-fi, Synthwave, Chillhop, Pop Hits, and more
- Featured track hero with instant "Listen Now"

### 📚 Library
- **Playlists** — create, edit, delete, add/remove tracks, set cover image and description
- **Favorites** — heart any track, access from your library
- **Play History** — full listening history with timestamps
- **Public Playlists** — shareable via unique token link

### 👤 Auth & Profile
- **Google login** via Clerk — one click sign-in
- User profile page with avatar, stats, and recent plays
- Protected routes — guests can browse, members can save

### ⬇️ Downloads
- Download any track as an audio file via the server proxy

### ⚡ PWA
- Installable as a Progressive Web App
- Service worker with smart cache control (JS/CSS never cached in dev)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  React + Vite (artifacts/madara-music)           │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ PlayerCtx   │  │  Pages / Components       │  │
│  │ (YT IFrame) │  │  (Wouter + TanStack Query)│  │
│  └──────┬──────┘  └──────────┬───────────────┘  │
│         │                    │                   │
│         ▼                    ▼                   │
│  [Hidden YouTube iframe]  [REST calls]           │
└──────────────────────────┬──────────────────────┘
                           │ /api/*
                           ▼
┌─────────────────────────────────────────────────┐
│  Express API Server (artifacts/api-server)       │
│                                                  │
│  /api/music/youtube/search  ← youtubei.js        │
│  /api/playlists             ← Drizzle ORM        │
│  /api/favorites             ← Drizzle ORM        │
│  /api/history               ← Drizzle ORM        │
│  /api/music/youtube/stream  ← audio proxy        │
│                                                  │
│  Auth middleware: Clerk Express SDK              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │  PostgreSQL DB  │
          │  (Drizzle ORM) │
          └────────────────┘
```

### Key Design Decisions

| Decision | Why |
|---|---|
| **YouTube IFrame API for playback** | Replit server IPs are blocked by YouTube for streaming — the browser plays directly, bypassing all server-side restrictions |
| **`play()` loads video synchronously** | Browser autoplay policy requires the video load to happen inside the user-gesture call stack, not a React `useEffect` |
| **`youtubei.js` (Innertube)** | No YouTube Data API key needed — uses the same internal API YouTube's own clients use |
| **OpenAPI + Orval codegen** | Type-safe hooks auto-generated from the spec (`lib/api-client-react`) — no manual fetch wrappers |
| **pnpm monorepo** | `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` shared between frontend and backend |

---

## 🗂️ Project Structure

```
yt_api_by_madara/
│
├── artifacts/
│   ├── madara-music/          # React + Vite frontend
│   │   └── src/
│   │       ├── components/    # UI kit (Radix/Shadcn), layout, player
│   │       ├── contexts/      # PlayerContext — global playback state
│   │       └── pages/         # Home, Search, Library, Playlist, Profile, Settings …
│   │
│   └── api-server/            # Express backend
│       └── src/
│           ├── routes/        # music, playlists, favorites, history, youtube
│           └── middlewares/   # Clerk auth, audio proxy
│
├── lib/
│   ├── db/                    # Drizzle ORM schema + PostgreSQL connection
│   ├── api-spec/              # OpenAPI 3.1 specification
│   ├── api-zod/               # Shared Zod validation schemas
│   └── api-client-react/      # Orval-generated TanStack Query hooks
│
├── package.json               # pnpm workspace root
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL database

### 1. Clone the repo
```bash
git clone https://github.com/ragini19854-prog/yt_api_by_madara.git
cd yt_api_by_madara
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Set environment variables

Create a `.env` file (or set these in your environment):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/madara_music

# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Session
SESSION_SECRET=your_super_secret_here
```

### 4. Run database migrations
```bash
pnpm --filter @workspace/db db:push
```

### 5. Start the dev servers
```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend (separate terminal)
pnpm --filter @workspace/madara-music run dev
```

Open `http://localhost:5173` 🎉

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 7, Tailwind CSS |
| **UI Components** | Radix UI, Shadcn/ui, Lucide Icons |
| **Routing** | Wouter |
| **Data Fetching** | TanStack Query (React Query) |
| **Backend** | Node.js, Express 4, TypeScript |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | Clerk (Google OAuth) |
| **YouTube** | `youtubei.js` (Innertube API, no API key) |
| **API Codegen** | Orval (OpenAPI → TanStack Query hooks) |
| **Package Manager** | pnpm workspaces (monorepo) |
| **PWA** | Vite PWA plugin + custom service worker |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/music/youtube/search` | Search YouTube music |
| `GET` | `/api/music/trending` | Trending tracks |
| `GET` | `/api/music/genres` | Genre list |
| `GET` | `/api/music/youtube/stream` | Proxy audio stream |
| `GET/POST` | `/api/playlists` | List / create playlists |
| `GET/PUT/DELETE` | `/api/playlists/:id` | Get / update / delete playlist |
| `POST/DELETE` | `/api/playlists/:id/tracks` | Add / remove track from playlist |
| `GET` | `/api/playlists/shared/:token` | Get shared playlist by token |
| `GET/POST/DELETE` | `/api/favorites` | List / add / remove favorites |
| `GET/POST` | `/api/history` | Get / record play history |

---

## 🎨 Screenshots

| Home | Search | Full Player |
|---|---|---|
| Trending + Featured hero | YouTube search results | Seek bar, volume, lyrics |

| Library | Playlist | Profile |
|---|---|---|
| Playlists + Favorites + History | Tracks with queue | Stats + recent plays |

---

## 📝 License

MIT © [Madara](https://github.com/ragini19854-prog)

---

<div align="center">

Built with ❤️ on Github · Powered by YouTube Innertube API

⭐ Star this repo if you found it useful!

</div>
