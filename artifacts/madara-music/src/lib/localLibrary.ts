import { useCallback, useEffect, useState } from "react";
import type { Playlist, PlaylistWithTracks, Track, UserStats } from "@workspace/api-client-react";

const STORAGE_KEY = "madara-music-library-v1";
const CHANGE_EVENT = "madara-library-change";

type LibraryState = {
  favorites: Track[];
  history: Track[];
  playlists: PlaylistWithTracks[];
  playCounts: Record<string, number>;
};

const emptyState: LibraryState = {
  favorites: [],
  history: [],
  playlists: [],
  playCounts: {},
};

function readState(): LibraryState {
  if (typeof window === "undefined") return emptyState;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Partial<LibraryState>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      playCounts: parsed.playCounts && typeof parsed.playCounts === "object" ? parsed.playCounts : {},
    };
  } catch {
    return emptyState;
  }
}

function writeState(state: LibraryState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function updateState(updater: (state: LibraryState) => LibraryState) {
  writeState(updater(readState()));
}

export function useLocalLibrary() {
  const [state, setState] = useState<LibraryState>(readState);

  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleFavorite = useCallback((track: Track) => {
    updateState((current) => {
      const exists = current.favorites.some((item) => item.id === track.id);
      return {
        ...current,
        favorites: exists
          ? current.favorites.filter((item) => item.id !== track.id)
          : [track, ...current.favorites],
      };
    });
  }, []);

  const recordPlay = useCallback((track: Track) => {
    updateState((current) => ({
      ...current,
      history: [track, ...current.history.filter((item) => item.id !== track.id)].slice(0, 50),
      playCounts: {
        ...current.playCounts,
        [track.id]: (current.playCounts[track.id] || 0) + 1,
      },
    }));
  }, []);

  const createPlaylist = useCallback((name: string) => {
    const playlist: PlaylistWithTracks = {
      id: Date.now(),
      name,
      description: null,
      coverUrl: null,
      userId: "local",
      isPublic: false,
      createdAt: new Date().toISOString(),
      tracks: [],
    };
    updateState((current) => ({ ...current, playlists: [playlist, ...current.playlists] }));
    return playlist;
  }, []);

  const updatePlaylist = useCallback((playlistId: number, changes: Partial<PlaylistWithTracks>) => {
    updateState((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, ...changes, trackCount: changes.tracks?.length ?? playlist.tracks.length }
          : playlist,
      ),
    }));
  }, []);

  const deletePlaylist = useCallback((playlistId: number) => {
    updateState((current) => ({
      ...current,
      playlists: current.playlists.filter((playlist) => playlist.id !== playlistId),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: number, track: Track) => {
    updateState((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) => {
        if (playlist.id !== playlistId || playlist.tracks.some((item) => item.id === track.id)) return playlist;
        const tracks = [...playlist.tracks, track];
        return { ...playlist, tracks, trackCount: tracks.length };
      }),
    }));
  }, []);

  const getStats = useCallback((): UserStats => {
    const artistCounts = new Map<string, number>();
    state.history.forEach((track) => artistCounts.set(track.artist, (artistCounts.get(track.artist) || 0) + 1));
    return {
      totalPlays: Object.values(state.playCounts).reduce((sum, count) => sum + count, 0),
      uniqueTracks: Object.keys(state.playCounts).length,
      playlistCount: state.playlists.length,
      favoriteCount: state.favorites.length,
      topArtists: [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([artist]) => artist),
    };
  }, [state]);

  return {
    ...state,
    getStats,
    toggleFavorite,
    recordPlay,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addToPlaylist,
  };
}

export type LocalPlaylist = Playlist;