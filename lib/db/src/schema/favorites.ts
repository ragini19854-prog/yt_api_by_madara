import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const favoritesTable = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
  trackTitle: text("track_title").notNull(),
  trackArtist: text("track_artist").notNull(),
  trackThumbnail: text("track_thumbnail").notNull(),
  previewUrl: text("preview_url").notNull(),
  duration: integer("duration").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favoritesTable).omit({ id: true, addedAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoritesTable.$inferSelect;
