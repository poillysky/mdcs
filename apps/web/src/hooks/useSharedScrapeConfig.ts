import { useCallback } from "react";
import { fetchScrapeConfig } from "../api";
import { useCachedQuery } from "./useCachedQuery";
import { SCRAPE_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { ScrapeConfig } from "../types";

type ScrapeConfigResponse = Awaited<ReturnType<typeof fetchScrapeConfig>>;

type Options = {
  controlled?: boolean;
  value?: ScrapeConfig;
  transform?: (cfg: ScrapeConfig) => ScrapeConfig;
  onError?: (error: unknown) => void;
};

export function useSharedScrapeConfig({
  controlled = false,
  value,
  transform,
  onError,
}: Options) {
  const { data, loading, refreshing, setData, reload } = useCachedQuery<ScrapeConfigResponse>({
    key: SCRAPE_CONFIG_KEY,
    fetcher: async () => {
      const res = await fetchScrapeConfig();
      return transform ? { ...res, config: transform(res.config) } : res;
    },
    enabled: !controlled,
    onError,
  });

  const config = controlled
    ? value
      ? transform
        ? transform(value)
        : value
      : null
    : data?.config ?? null;

  const setConfig = useCallback(
    (next: ScrapeConfig | ((prev: ScrapeConfig | null) => ScrapeConfig | null)) => {
      if (controlled) return;
      setData((prev) => {
        const current = prev?.config ?? null;
        const resolved = typeof next === "function" ? next(current) : next;
        if (!resolved) return prev;
        return prev ? { ...prev, config: resolved } : { config: resolved, catalog: [], providers: [] };
      });
    },
    [controlled, setData],
  );

  return {
    config,
    loading: controlled ? false : loading,
    refreshing,
    setConfig,
    setData,
    reload,
    raw: data,
  };
}
