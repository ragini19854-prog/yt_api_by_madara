import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playHistoryTable = pgTable("play_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
  trackTitle: text("track_title").notNull(),
  trackArtist: text("track_artist").notNull(),
  trackThumbnail: text("track_thumbnail").notNull(),
  previewUrl: text("preview_url").notNull(),
  duration: integer("duration").notNull().default(0),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayHistorySchema = createInsertSchema(playHistoryTable).omit({ id: true, playedAt: true });
export type InsertPlayHistory = z.infer<typeof insertPlayHistorySchema>;
export type PlayHistory = typeof playHistoryTable.$inferSelect;
