import { useEffect, useSyncExternalStore } from "react";
import { fetchIndexAllStatus } from "../api";
import type { IndexAllStatus } from "../types";
import {
  applyIndexAllUpdate,
  getIndexAllStatusSnapshot,
  onIndexAllComplete,
  subscribeIndexAllStatus,
  syncIndexAllFromServer,
} from "./indexAllStore";

export { applyIndexAllUpdate, setIndexAllRunning } from "./indexAllStore";

type Options = {
  onComplete?: (index: IndexAllStatus) => void;
};

export function useSharedIndexAll(opts?: Options) {
  const indexStatus = useSyncExternalStore(
    subscribeIndexAllStatus,
    getIndexAllStatusSnapshot,
    getIndexAllStatusSnapshot,
  );

  useEffect(() => {
    if (!opts?.onComplete) return;
    return onIndexAllComplete(opts.onComplete);
  }, [opts?.onComplete]);

  return {
    indexStatus,
    indexingAll: Boolean(indexStatus?.running),
  };
}

export async function refreshIndexAllStatus() {
  try {
    const { index } = await fetchIndexAllStatus();
    syncIndexAllFromServer(index);
  } catch {
    /* ignore */
  }
}
