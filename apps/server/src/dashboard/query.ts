import { loadScrapeConfig } from "../config/loadScrape.js";
import { openDatabase } from "../db/init.js";
import {
  FILE_ACTIVITY_TS,
  FILE_LIST_JOINS,
  FILE_LIST_SELECT,
  mapFileListRow,
} from "../api/fileListMap.js";

export type DashboardWeekCompare = {
  text: string;
  tone: "up" | "down" | "flat";
};

export type DashboardQueryOpts = {
  activityPage?: number;
  activityPageSize?: number;
  activityKind?: string;
};

export function queryDashboard(opts: DashboardQueryOpts = {}) {
  const db = openDatabase();
  const config = loadScrapeConfig();
  const scrapeMax = Math.max(1, config.exportFastConcurrency ?? 4);

  const actorTotal = (
    db.prepare(`SELECT COUNT(*) AS c FROM actor_profiles`).get() as { c: number }
  ).c;

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = now - weekMs;
  const lastWeekStart = now - 2 * weekMs;

  const countDoneInRange = (start: number, end: number) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM files f
           WHERE f.status = 'done' AND ${FILE_ACTIVITY_TS} >= ? AND ${FILE_ACTIVITY_TS} < ?`,
        )
        .get(start, end) as { c: number }
    ).c;

  const recentAdded7d = countDoneInRange(thisWeekStart, now);
  const thisWeek = recentAdded7d;
  const lastWeek = countDoneInRange(lastWeekStart, thisWeekStart);

  let weekCompare: DashboardWeekCompare | null = null;
  if (lastWeek <= 0) {
    if (thisWeek > 0) weekCompare = { text: `+${thisWeek} 对比上周`, tone: "up" };
  } else {
    const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
    const sign = pct > 0 ? "+" : "";
    weekCompare = {
      text: `${sign}${pct.toFixed(2)}% 对比上周`,
      tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
    };
  }

  const activityPage = Math.max(1, opts.activityPage ?? 1);
  const activityPageSize = Math.min(50, Math.max(1, opts.activityPageSize ?? 20));
  const offset = (activityPage - 1) * activityPageSize;

  const where: string[] = [`f.status = 'done'`];
  const params: (string | number)[] = [];
  if (opts.activityKind?.trim()) {
    where.push("f.kind = ?");
    params.push(opts.activityKind.trim());
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM files f ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT ${FILE_LIST_SELECT}
       ${FILE_LIST_JOINS}
       ${whereSql}
       ORDER BY ${FILE_ACTIVITY_TS} DESC, f.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, activityPageSize, offset) as Array<Record<string, unknown>>;

  return {
    scrapeMax,
    actorTotal,
    recentAdded7d,
    weekCompare,
    activity: {
      files: rows.map(mapFileListRow),
      total,
      page: activityPage,
      pageSize: activityPageSize,
    },
  };
}
