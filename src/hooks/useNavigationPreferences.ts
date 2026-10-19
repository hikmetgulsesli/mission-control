import { useCallback, useEffect, useState } from 'react';
import { NAVIGATION_ITEMS } from '../lib/navigation';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'mission-control.navigation.v1';
const knownIds = new Set(NAVIGATION_ITEMS.map(item => item.id));

function knownFavorites(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && knownIds.has(id)))] : [];
}

function browserStorage(): PreferenceStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readNavigationFavorites(storage?: PreferenceStorage): string[] {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1 || !('favorites' in saved)) return [];
    return knownFavorites(saved.favorites);
  } catch { return []; }
}

export function writeNavigationFavorites(storage: PreferenceStorage | undefined, ids: readonly string[]): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, favorites: knownFavorites(ids) })); }
  catch { /* Favorites remain usable in memory if storage is unavailable. */ }
}

export function toggleNavigationFavorite(ids: readonly string[], id: string): string[] {
  const favorites = knownFavorites(ids);
  if (!knownIds.has(id)) return favorites;
  return favorites.includes(id) ? favorites.filter(candidate => candidate !== id) : [...favorites, id];
}

export function useNavigationPreferences() {
  const [favoriteIds, setFavoriteIds] = useState(() => readNavigationFavorites(browserStorage()));
  useEffect(() => { writeNavigationFavorites(browserStorage(), favoriteIds); }, [favoriteIds]);
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds(ids => toggleNavigationFavorite(ids, id));
  }, []);
  return { favoriteIds, toggleFavorite };
}
