import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscardDraft } from "./settingsDiscard";

export type { DiscardDraft } from "./settingsDiscard";

export type SettingsSaveActions = {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  /** 放弃未保存修改，恢复为磁盘/服务端状态 */
  discard?: DiscardDraft;
};

/**
 * 设置页通用 dirty 基线：后台刷新时未编辑则同步，编辑中保留草稿。
 * controlled（弹窗）模式下始终 dirty=false。
 */
export function useDirtyBaseline<T>(opts: {
  current: T | null;
  enabled?: boolean;
}): {
  dirty: boolean;
  markClean: (next: T) => void;
} {
  const enabled = opts.enabled !== false;
  const [baseline, setBaseline] = useState<T | null>(null);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => {
    if (!enabled || opts.current == null || baseline == null) return false;
    return JSON.stringify(opts.current) !== JSON.stringify(baseline);
  }, [enabled, opts.current, baseline]);

  dirtyRef.current = dirty;

  useEffect(() => {
    if (!enabled || opts.current == null) return;
    if (!dirtyRef.current) {
      setBaseline(opts.current);
    } else {
      setBaseline((prev) => (prev == null ? opts.current : prev));
    }
  }, [enabled, opts.current]);

  const markClean = useCallback((next: T) => {
    setBaseline(next);
  }, []);

  return { dirty, markClean };
}

export function useReportSaveActions(
  enabled: boolean,
  dirty: boolean,
  saving: boolean,
  save: () => Promise<void>,
  onActionsChange?: (actions: SettingsSaveActions | null) => void,
  discard?: DiscardDraft,
) {
  useEffect(() => {
    if (!enabled || !onActionsChange) return;
    onActionsChange({ dirty, saving, save, discard });
    return () => onActionsChange(null);
  }, [enabled, dirty, saving, save, discard, onActionsChange]);
}
