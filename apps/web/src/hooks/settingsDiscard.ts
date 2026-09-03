import { useCallback } from "react";
import { invalidateCachedQuery } from "./useCachedQuery";

export type DiscardDraft = () => void | Promise<void>;

/** 放弃草稿：清共享缓存并从服务端重新拉取 */
export function useCacheDiscard(
  key: string,
  reload: (opts?: { silent?: boolean }) => Promise<void>,
  resetLocal?: () => void,
): DiscardDraft {
  return useCallback(async () => {
    resetLocal?.();
    invalidateCachedQuery(key);
    await reload({ silent: true });
  }, [key, reload, resetLocal]);
}
