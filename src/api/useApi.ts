import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  // When the live request failed and a copy saved on this phone is shown instead.
  savedAt: string | null;
  reload: () => void;
}

// GET with a per-path copy kept on the phone, so screens still show the last figures when the connection drops.
export function useApi<T>(path: string | null, options: { cache?: boolean } = {}): ApiState<T> {
  const cacheKey = path ? `vortex.cache.${path}` : null;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!path) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
        setSavedAt(null);
        if (options.cache && cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ at: new Date().toISOString(), data: result }));
          } catch {
            // Storage full or unavailable: the live figures still show.
          }
        }
      })
      .catch((err: Error) => {
        if (id !== requestId.current) return;
        setError(err.message);
        if (options.cache && cacheKey) {
          try {
            const saved = localStorage.getItem(cacheKey);
            if (saved) {
              const parsed = JSON.parse(saved) as { at: string; data: T };
              setData(parsed.data);
              setSavedAt(parsed.at);
            }
          } catch {
            // No usable saved copy.
          }
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, savedAt, reload };
}
