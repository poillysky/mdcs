import { useCallback } from "react";
import { fetchOpsConfig } from "../api";
import { useCachedQuery } from "./useCachedQuery";
import { OPS_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { OpsConfig } from "../types";

type Options = {
  onError?: (error: unknown) => void;
  transform?: (cfg: OpsConfig) => OpsConfig;
};

export function useSharedOpsConfig({ onError, transform }: Options = {}) {
  const { data, loading, refreshing, setData, reload } = useCachedQuery<OpsConfig>({
    key: OPS_CONFIG_KEY,
    fetcher: async () => {
      const res = await fetchOpsConfig();
      return transform ? transform(res.config) : res.config;
    },
    onError,
  });

  const setConfig = useCallback(
    (next: OpsConfig | ((prev: OpsConfig | null) => OpsConfig | null)) => {
      setData((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        return resolved;
      });
    },
    [setData],
  );

  return { config: data, loading, refreshing, setConfig, reload };
}
