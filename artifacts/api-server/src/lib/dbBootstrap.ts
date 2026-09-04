import { pool } from "@workspace/db";
import { logger } from "./logger";

// Mirrors lib/db/src/schema/*.ts exactly. The runtime container doesn't
// ship drizzle-kit (only the compiled server), so there's no way to run
// `drizzle-kit push` against a freshly provisioned database once deployed.
// Running this once at boot means a brand-new Postgres (or one that was
// reset/reprovisioned) just works, without anyone needing local tooling
// or DB console access to fix it manually.
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL DEFAULT 'Default Key',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "playlists" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "cover_url" text,
  "user_id" text NOT NULL,
  "is_public" boolean NOT NULL DEFAULT false,
  "share_token" text UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlist_tracks" (
  "id" serial PRIMARY KEY,
  "playlist_id" integer NOT NULL,
  "track_id" text NOT NULL,
  "track_title" text NOT NULL,
  "track_artist" text NOT NULL,
  "track_thumbnail" text NOT NULL,
  "preview_url" text NOT NULL,
  "duration" integer NOT NULL DEFAULT 0,
  "added_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "favorites" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "track_id" text NOT NULL,
  "track_title" text NOT NULL,
  "track_artist" text NOT NULL,
  "track_thumbnail" text NOT NULL,
  "preview_url" text NOT NULL,
  "duration" integer NOT NULL DEFAULT 0,
  "added_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "play_history" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "track_id" text NOT NULL,
  "track_title" text NOT NULL,
  "track_artist" text NOT NULL,
  "track_thumbnail" text NOT NULL,
  "preview_url" text NOT NULL,
  "duration" integer NOT NULL DEFAULT 0,
  "played_at" timestamptz NOT NULL DEFAULT now()
);
`;

// Never throws — a bootstrap failure (e.g. DB briefly unreachable at boot)
// must not take the whole server down. DB-backed routes already handle
// query errors individually; this is just a best-effort convenience so
// the common case (fresh database) doesn't need any manual step.
export async function ensureSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  try {
    await pool.query(BOOTSTRAP_SQL);
    logger.info("Database schema verified (created any missing tables)");
  } catch (err) {
    logger.error(
      { err },
      "Database schema bootstrap failed — DB-backed routes (playlists, favorites, history, API keys) may error until this is resolved",
    );
  }
}
