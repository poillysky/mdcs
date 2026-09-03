import { useEffect, useState } from "react";
import { probeProviders as probeProvidersApi } from "../../../api";
import type { NotifyFn } from "../../../lib/notify";
import type { ProviderCatalogRow } from "../../../types";
import {
  PROBE_BATCH_SIZE,
  PROBE_LAST_AT_KEY,
  claimProbeDay,
  isProbeDoneForDay,
  localDayKey,
  nextProbeSlot,
  persistProbeSnapshot,
  readStoredProbeStatus,
  type ProbeStatus,
} from "../probeStorage";
import { orderedProviderIds } from "../providerDisplay";

type Args = {
  controlled: boolean;
  loading: boolean;
  catalog: ProviderCatalogRow[];
  notify: NotifyFn;
};

export function useProviderProbe({ controlled, loading, catalog, notify }: Args) {
  const [probing, setProbing] = useState(false);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [probeStatus, setProbeStatus] = useState<Record<string, ProbeStatus>>(() =>
    readStoredProbeStatus(),
  );
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(PROBE_LAST_AT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastProbeAt) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [lastProbeAt]);

  async function runProbe(id: string): Promise<"ok" | "fail"> {
    setProbeStatus((prev) => ({ ...prev, [id]: "testing" }));
    try {
      const data = await probeProvidersApi({ id, clearCooldown: true });
      const row = data.results?.[0];
      const ok = Boolean(row?.ok);
      const status: ProbeStatus = ok ? "ok" : "fail";
      setProbeStatus((prev) => ({ ...prev, [id]: status }));
      setLastProbeAt(Date.now());
      return status;
    } catch {
      setProbeStatus((prev) => ({ ...prev, [id]: "fail" }));
      setLastProbeAt(Date.now());
      return "fail";
    }
  }

  async function probePool(ids: string[]) {
    let cursor = 0;
    async function worker() {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        if (!id) continue;
        await runProbe(id);
      }
    }
    const slots = Math.min(PROBE_BATCH_SIZE, ids.length);
    await Promise.all(Array.from({ length: slots }, () => worker()));
  }

  async function probeAll(opts?: { silent?: boolean }) {
    if (probing || probingId) return;
    const allIds = orderedProviderIds(catalog, true);
    if (!allIds.length) {
      if (!opts?.silent) notify("ok", "无已启用的数据源需要测试");
      return;
    }

    claimProbeDay();
    setProbing(true);
    try {
      await probePool(allIds);
      const at = Date.now();
      setProbeStatus((prev) => {
        persistProbeSnapshot(prev, at);
        return prev;
      });
      setLastProbeAt(at);
      if (!opts?.silent) notify("ok", "联通性测试完成");
    } catch (e) {
      if (!opts?.silent) notify("error", e, "测试失败");
    } finally {
      setProbing(false);
    }
  }

  async function probeOne(id: string, label: string) {
    if (probing || probingId) return;
    setProbingId(id);
    setProbeStatus((prev) => ({ ...prev, [id]: "testing" }));
    try {
      const data = await probeProvidersApi({ id, clearCooldown: true });
      const row = data.results?.[0];
      const ok = Boolean(row?.ok);
      const status: ProbeStatus = ok ? "ok" : "fail";
      setProbeStatus((prev) => {
        const next: Record<string, ProbeStatus> = { ...prev, [id]: status };
        persistProbeSnapshot(next, Date.now());
        return next;
      });
      setLastProbeAt(Date.now());
      const detail = row?.message ? `：${row.message}` : "";
      if (ok) notify("ok", `${label} 可达${detail}`);
      else notify("error", `${label} 不可达${detail}`);
    } catch (e) {
      setProbeStatus((prev) => {
        const next: Record<string, ProbeStatus> = { ...prev, [id]: "fail" };
        persistProbeSnapshot(next, Date.now());
        return next;
      });
      setLastProbeAt(Date.now());
      notify("error", e, `${label} 测试失败`);
    } finally {
      setProbingId(null);
    }
  }

  useEffect(() => {
    if (controlled || loading || !catalog.length) return;

    if (!isProbeDoneForDay()) {
      const last = Number(localStorage.getItem(PROBE_LAST_AT_KEY) || 0);
      if (Number.isFinite(last) && last > 0 && localDayKey(new Date(last)) === localDayKey()) {
        claimProbeDay();
      }
    }

    let timer: number | null = null;
    let cancelled = false;

    const runScheduledProbe = () => {
      if (cancelled) return;
      const day = localDayKey();
      if (isProbeDoneForDay(day)) return;
      claimProbeDay(day);
      void probeAll({ silent: true });
    };

    const armNextSlot = () => {
      if (cancelled) return;
      if (timer != null) window.clearTimeout(timer);
      const delay = Math.max(1000, nextProbeSlot().getTime() - Date.now());
      timer = window.setTimeout(() => {
        runScheduledProbe();
        armNextSlot();
      }, delay);
    };

    armNextSlot();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, loading, catalog.length]);

  return {
    probing,
    probingId,
    probeStatus,
    lastProbeAt,
    probeAll,
    probeOne,
  };
}
