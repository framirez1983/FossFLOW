import { useCallback, useEffect, useRef, useState } from 'react';
import type { Icon, LibraryIcon, LibraryManagerProps } from 'fossflow';
import { iconLibraryService } from '../services/iconLibraryService';

/**
 * Server-backed Icon Library state for the current browser session.
 *
 * The server is the only source of truth: entries are fetched on mount (and
 * on demand), mutations POST/PUT/DELETE then refresh local state. Nothing is
 * cached in localStorage/IndexedDB. When the server is unreachable the hook
 * reports `unavailable` so library UI hides/disables itself while the rest
 * of the app keeps working.
 *
 * Library changes never touch the diagram model, so they never dirty the
 * project or append history entries.
 */
export const useIconLibrary = (): LibraryManagerProps & {
  reload: () => Promise<void>;
} => {
  const [icons, setIcons] = useState<LibraryIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await iconLibraryService.list();
      if (!mountedRef.current) return;
      setIcons(entries);
      setUnavailable(false);
    } catch (err) {
      if (!mountedRef.current) return;
      // Unreachable server (or disabled storage): library unavailable.
      // Never fall back to browser-local storage.
      setUnavailable(true);
      setError(err instanceof Error ? err.message : 'Library unavailable');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addIcon = useCallback(async (icon: Icon) => {
    const result = await iconLibraryService.add(icon);
    await refresh();
    return result;
  }, [refresh]);

  const renameIcon = useCallback(
    async (id: string, name: string) => {
      const entry = await iconLibraryService.rename(id, name);
      await refresh();
      return entry;
    },
    [refresh]
  );

  const deleteIcon = useCallback(
    async (id: string) => {
      await iconLibraryService.remove(id);
      await refresh();
    },
    [refresh]
  );

  const isInLibrary = useCallback(
    (url: string) => {
      return icons.some((entry) => {
        return entry.url === url;
      });
    },
    [icons]
  );

  return {
    icons,
    loading,
    error,
    unavailable,
    refresh,
    reload: refresh,
    addIcon,
    renameIcon,
    deleteIcon,
    isInLibrary
  };
};
