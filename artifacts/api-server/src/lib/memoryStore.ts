import { randomUUID } from "crypto";

export type MemoryTrack = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  thumbnail: string;
  previewUrl: string;
  duration: number;
  genre: string | null;
  source?: string | null;
  videoId?: string | null;
};

export type MemoryPlaylist = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  shareToken: string | null;
  tracks: MemoryTrack[];
};

export type MemoryPlay = MemoryTrack & { playedAt: string };

const playlists: MemoryPlaylist[] = [];
const favorites = new Map<string, MemoryTrack[]>();
const history = new Map<string, MemoryPlay[]>();
let nextPlaylistId = 1;

export function getPlaylists(userId: string) {
  return playlists
    .filter((playlist) => playlist.userId === userId)
    .map(({ tracks, shareToken, ...playlist }) => ({ ...playlist, trackCount: tracks.length }));
}

export function getPlaylist(id: number) {
  return playlists.find((playlist) => playlist.id === id);
}

export function createPlaylist(input: {
  name: string;
  description?: string;
  coverUrl?: string;
  userId: string;
  isPublic?: boolean;
}) {
  const playlist: MemoryPlaylist = {
    id: nextPlaylistId++,
    name: input.name,
    description: input.description || null,
    coverUrl: input.coverUrl || null,
    userId: input.userId,
    isPublic: Boolean(input.isPublic),
    createdAt: new Date().toISOString(),
    shareToken: null,
    tracks: [],
  };
  playlists.push(playlist);
  return playlist;
}

export function playlistResponse(playlist: MemoryPlaylist) {
  const { shareToken, tracks, ...metadata } = playlist;
  return { ...metadata, trackCount: tracks.length, tracks };
}

export function updatePlaylist(id: number, changes: Record<string, unknown>) {
  const playlist = getPlaylist(id);
  if (!playlist) return undefined;
  if (changes.name !== undefined) playlist.name = String(changes.name);
  if (changes.description !== undefined) playlist.description = String(changes.description);
  if (changes.coverUrl !== undefined) playlist.coverUrl = String(changes.coverUrl);
  if (changes.isPublic !== undefined) playlist.isPublic = Boolean(changes.isPublic);
  return playlist;
}

export function deletePlaylist(id: number) {
  const index = playlists.findIndex((playlist) => playlist.id === id);
  if (index === -1) return false;
  playlists.splice(index, 1);
  return true;
}

export function sharePlaylist(id: number) {
  const playlist = getPlaylist(id);
  if (!playlist) return undefined;
  playlist.shareToken ||= randomUUID();
  playlist.isPublic = true;
  return playlist.shareToken;
}

export function findSharedPlaylist(token: string) {
  return playlists.find((playlist) => playlist.shareToken === token && playlist.isPublic);
}

export function addTrack(playlistId: number, track: MemoryTrack) {
  const playlist = getPlaylist(playlistId);
  if (!playlist) return undefined;
  if (!playlist.tracks.some((item) => item.id === track.id)) playlist.tracks.push(track);
  return track;
}

export function removeTrack(playlistId: number, trackId: string) {
  const playlist = getPlaylist(playlistId);
  if (!playlist) return false;
  playlist.tracks = playlist.tracks.filter((track) => track.id !== trackId);
  return true;
}

export function getFavorites(userId: string) {
  return favorites.get(userId) || [];
}

export function toggleFavorite(userId: string, track: MemoryTrack, remove = false) {
  const current = getFavorites(userId);
  const exists = current.some((item) => item.id === track.id);
  const next = remove || exists ? current.filter((item) => item.id !== track.id) : [track, ...current];
  favorites.set(userId, next);
  return next;
}

export function addPlay(userId: string, track: MemoryTrack) {
  const current = history.get(userId) || [];
  history.set(userId, [{ ...track, playedAt: new Date().toISOString() }, ...current].slice(0, 100));
}

export function getHistory(userId: string, limit: number) {
  const seen = new Set<string>();
  return (history.get(userId) || [])
    .filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    })
    .slice(0, limit);
}

export function getStats(userId: string) {
  const plays = history.get(userId) || [];
  const uniqueTracks = new Set(plays.map((track) => track.id));
  const artistCounts = new Map<string, number>();
  plays.forEach((track) => artistCounts.set(track.artist, (artistCounts.get(track.artist) || 0) + 1));
  return {
    totalPlays: plays.length,
    uniqueTracks: uniqueTracks.size,
    playlistCount: playlists.filter((playlist) => playlist.userId === userId).length,
    favoriteCount: getFavorites(userId).length,
    topArtists: [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([artist]) => artist),
  };
}