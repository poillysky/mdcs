import { useCallback, useEffect, useRef, useState } from "react";

type CacheEntry = { data: unknown; ts: number };

const queryCache = new Map<string, CacheEntry>();

export function readCachedQuery<T>(key: string): T | null {
  const hit = queryCache.get(key);
  return hit ? (hit.data as T) : null;
}

export function writeCachedQuery<T>(key: string, data: T) {
  queryCache.set(key, { data, ts: Date.now() });
}

export function invalidateCachedQuery(key: string) {
  queryCache.delete(key);
}

/** 使某 scope 下全部分页/筛选缓存失效（如创建任务后刷新任务列表） */
export function invalidateCachedQueryPrefix(prefix: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key);
  }
}

export type UseCachedQueryOptions<T> = {
  key: string;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  onError?: (error: unknown) => void;
};

export type UseCachedQueryResult<T> = {
  data: T | null;
  /** 无缓存时的首次加载 */
  loading: boolean;
  /** 有缓存时的后台刷新 */
  refreshing: boolean;
  setData: (next: T | ((prev: T | null) => T | null)) => void;
  reload: (opts?: { silent?: boolean }) => Promise<void>;
};

export function useCachedQuery<T>({
  key,
  fetcher,
  enabled = true,
  onError,
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const cached = enabled ? readCachedQuery<T>(key) : null;
  const [data, setDataState] = useState<T | null>(cached);
  const [loading, setLoading] = useState(Boolean(enabled && !cached));
  const [refreshing, setRefreshing] = useState(false);
  const seqRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  fetcherRef.current = fetcher;
  onErrorRef.current = onError;

  const setData = useCallback(
    (next: T | ((prev: T | null) => T | null)) => {
      setDataState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: T | null) => T | null)(prev)
            : next;
        if (resolved != null) writeCachedQuery(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return;
      const seq = ++seqRef.current;
      const hasData = readCachedQuery<T>(key) != null;
      const silent = opts?.silent ?? hasData;
      if (!silent) {
        if (hasData) setRefreshing(true);
        else setLoading(true);
      }
      try {
        const result = await fetcherRef.current();
        if (seq !== seqRef.current) return;
        writeCachedQuery(key, result);
        setDataState(result);
      } catch (error) {
        if (seq !== seqRef.current) return;
        onErrorRef.current?.(error);
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, key],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const hit = readCachedQuery<T>(key);
    if (hit) {
      setDataState(hit);
      setLoading(false);
      void reload({ silent: true });
    } else {
      setDataState(null);
      void reload({ silent: false });
    }
    return () => {
      seqRef.current += 1;
    };
  }, [enabled, key, reload]);

  return { data, loading, refreshing, setData, reload };
}

/** 列表/分页查询的稳定 cache key */
export function listQueryKey(scope: string, params: Record<string, unknown>): string {
  return `${scope}:${JSON.stringify(params)}`;
}
