export type ProbeStatus = "ok" | "fail" | "unknown" | "testing";

export const PROBE_BATCH_SIZE = 3;
export const PROBE_LAST_AT_KEY = "mdcs_provider_probe_last_at";
export const PROBE_STATUS_KEY = "mdcs_provider_probe_status";
/** 已完成（或已认领）的本地日历日 YYYY-MM-DD，用于「每天 01:00 仅测一次」 */
export const PROBE_DAY_KEY = "mdcs_provider_probe_day";
export const PROBE_HOUR = 1;
export const PROBE_MINUTE = 0;

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayProbeSlotStart(now = new Date()): Date {
  const t = new Date(now);
  t.setHours(PROBE_HOUR, PROBE_MINUTE, 0, 0);
  return t;
}

/** 下一次 01:00（若当前已过今日 01:00，则为明日 01:00） */
export function nextProbeSlot(now = new Date()): Date {
  const slot = todayProbeSlotStart(now);
  if (now.getTime() < slot.getTime()) return slot;
  const next = new Date(slot);
  next.setDate(next.getDate() + 1);
  return next;
}

export function isProbeDoneForDay(day = localDayKey()): boolean {
  try {
    return localStorage.getItem(PROBE_DAY_KEY) === day;
  } catch {
    return false;
  }
}

export function claimProbeDay(day = localDayKey()): void {
  try {
    localStorage.setItem(PROBE_DAY_KEY, day);
  } catch {
    /* quota / private mode */
  }
}

export function readStoredProbeStatus(): Record<string, ProbeStatus> {
  try {
    const raw = localStorage.getItem(PROBE_STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ProbeStatus>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, ProbeStatus> = {};
    for (const [id, status] of Object.entries(parsed)) {
      if (status === "ok" || status === "fail" || status === "unknown") next[id] = status;
    }
    return next;
  } catch {
    return {};
  }
}

export function persistProbeSnapshot(status: Record<string, ProbeStatus>, at: number) {
  const snapshot: Record<string, ProbeStatus> = {};
  for (const [id, s] of Object.entries(status)) {
    if (s === "ok" || s === "fail" || s === "unknown") snapshot[id] = s;
  }
  try {
    localStorage.setItem(PROBE_STATUS_KEY, JSON.stringify(snapshot));
    localStorage.setItem(PROBE_LAST_AT_KEY, String(at));
  } catch {
    /* quota / private mode */
  }
}
