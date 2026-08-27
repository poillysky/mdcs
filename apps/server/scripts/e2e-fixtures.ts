import fs from "node:fs";
import path from "node:path";
import { getCatalogEntry } from "../src/scrape/providers/catalog.js";
import type { SourceId } from "../src/scrape/types.js";
import type { KindId } from "../src/types.js";
import { PROJECT_ROOT } from "../src/paths.js";

/** 端到端默认用本地索引里的真实番号（--strm 可覆盖） */
export type E2eFixture = {
  kind: KindId;
  /** 相对 PROJECT_ROOT */
  sourceRel: string;
  code: string;
};

const JAPAN_CENSORED = {
  kind: "japan_censored" as const,
  sourceRel: "media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm",
  code: "SONE-001",
};

/** FC2 组统一 PPV 样例（fd2ppv / fc2_hub 批量 E2E 对齐） */
const FC2_PPV_3275049 = {
  kind: "fc2" as const,
  sourceRel: "media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm",
  code: "FC2-PPV-3275049",
};

/** ThePornDB 欧美样例（REST parse= 搜索） */
const THEPORNDB_WESTERN = {
  kind: "western" as const,
  sourceRel: "media/_e2e/western/PURETABOO/PURETABOO.2026.07.14.strm",
  code: "PURETABOO.2026.07.14",
};

/** 数据源 → 索引样例（对齐 UI 代理组 + 各 Kind 真实番号格式） */
export const E2E_FIXTURES: Partial<Record<SourceId, E2eFixture>> = {
  javbus: JAPAN_CENSORED,
  javdb: JAPAN_CENSORED,
  dmm: JAPAN_CENSORED,
  libredmm: JAPAN_CENSORED,
  airav: JAPAN_CENSORED,
  airav_io: JAPAN_CENSORED,
  carib: {
    kind: "japan_uncensored",
    sourceRel: "media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm",
    code: "CARIB-010117-339",
  },
  avsox: {
    kind: "japan_uncensored",
    sourceRel: "media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm",
    code: "CARIB-010117-339",
  },
  avmoo: JAPAN_CENSORED,
  javday: JAPAN_CENSORED,
  jav321: JAPAN_CENSORED,
  avbase: JAPAN_CENSORED,
  javlibrary: JAPAN_CENSORED,
  miss_av: JAPAN_CENSORED,
  njav: JAPAN_CENSORED,
  mgstage: {
    kind: "japan_censored" as const,
    sourceRel: "media/本地索引/日本有码/PRESTIGE/ABP/ABP-001.strm",
    code: "ABP-001",
  },
  freejavbt: JAPAN_CENSORED,
  sevenmmtv: JAPAN_CENSORED,
  iqqtv: JAPAN_CENSORED,
  avsex: JAPAN_CENSORED,
  r18dev: JAPAN_CENSORED,
  fc2_hub: FC2_PPV_3275049,
  fd2ppv: FC2_PPV_3275049,
  fc2: {
    kind: "fc2",
    sourceRel: "media/本地索引/FC2/未分类/FC2/FC2-1545500.strm",
    code: "FC2-1545500",
  },
  madou: {
    kind: "china",
    sourceRel: "media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm",
    code: "MDX-0001",
  },
  madouqu: {
    kind: "china",
    sourceRel: "media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm",
    code: "MDX-0006",
  },
  hscangku: {
    kind: "china",
    sourceRel: "media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm",
    code: "MDX-0006",
  },
  xiao_huang_shu: {
    kind: "china",
    sourceRel: "media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm",
    code: "MDX-0006",
  },
  lulubar: JAPAN_CENSORED,
  theporndb: THEPORNDB_WESTERN,
  avheat: {
    kind: "western",
    sourceRel: "media/_e2e/western/WeLiveTogether/WeLiveTogether.12.02.23.strm",
    code: "WeLiveTogether.12.02.23",
  },
};

export function resolveE2eFixture(sourceId: SourceId, strmOverride?: string): E2eFixture {
  const base = E2E_FIXTURES[sourceId];
  if (!base && !strmOverride) {
    throw new Error(`未配置 ${sourceId} 的索引样例；请用 --strm=media/本地索引/...`);
  }
  const sourceRel = (strmOverride || base!.sourceRel).replace(/\\/g, "/");
  const abs = path.join(PROJECT_ROOT, sourceRel);
  if (!fs.existsSync(abs)) {
    throw new Error(`索引 strm 不存在: ${sourceRel}`);
  }
  const code = (strmOverride ? path.basename(sourceRel, path.extname(sourceRel)) : base?.code) ||
    path.basename(sourceRel, path.extname(sourceRel));
  return {
    kind: base?.kind || inferKindFromPath(sourceRel),
    sourceRel,
    code,
  };
}

function inferKindFromPath(sourceRel: string): KindId {
  const p = sourceRel.toLowerCase();
  if (p.includes("/fc2/") || /^fc2/i.test(path.basename(sourceRel))) return "fc2";
  if (p.includes("/western") || p.includes("/欧美")) return "western";
  if (p.includes("/国产") || p.includes("/china")) return "china";
  if (p.includes("/日本无码") || p.includes("carib")) return "japan_uncensored";
  if (p.includes("/日本素人")) return "japan_amateur";
  return "japan_censored";
}

export function e2eOutRoot(fixture: E2eFixture, sourceId: SourceId): string {
  const seriesPrefix = fixture.code.split("-")[0] || fixture.code;
  const kindDir =
    fixture.kind === "japan_censored"
      ? path.join("media", "片商目录", "日本有码", seriesPrefix, fixture.code)
      : path.join("media", "_e2e", fixture.kind, fixture.code);
  return path.join(PROJECT_ROOT, kindDir, "_scrap", sourceId, "organized");
}

export function printFixtureTable(): void {
  console.log("数据源端到端索引样例（--id=源 --strm=可覆盖）:\n");
  for (const entry of Object.keys(E2E_FIXTURES) as SourceId[]) {
    const f = E2E_FIXTURES[entry]!;
    const label = getCatalogEntry(entry)?.label || entry;
    const ok = fs.existsSync(path.join(PROJECT_ROOT, f.sourceRel)) ? "✓" : "✗";
    console.log(`  ${ok} ${entry.padEnd(16)} ${label.padEnd(12)} ${f.code.padEnd(18)} ${f.sourceRel}`);
  }
}
