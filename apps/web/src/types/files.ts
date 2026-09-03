export type FileRow = {
  id: number;
  kind: string;
  source_path: string;
  file_name: string;
  code: string | null;
  status: string;
  error?: string | null;
  file_size?: number;
  file_mtime?: number;
  cd_index?: number;
  mosaic?: string;
  scraped_at?: number | null;
  organized_at?: number | null;
  target_path?: string | null;
  title?: string | null;
  /** 中文标题（有则列表/导航优先） */
  titleZh?: string | null;
  actors?: string | null;
  duration?: string | null;
  /** 发行日 YYYY-MM-DD（列表从 meta 解析） */
  premiered?: string | null;
  /** 任务来源：manual | monitor（join jobs.trigger_source；无 job 时默认 manual） */
  triggerSource?: "manual" | "monitor";
  scrape_source?: string | null;
  cover_url?: string | null;
};

export type SourceSnapshotView = {
  fields: Record<string, unknown>;
  coverUrl?: string | null;
  alternateCoverUrls?: string[];
  extrafanartUrls?: string[];
  error?: string;
};

export type ScrapeMetaView = {
  code: string;
  /** DMM CID / 发行码（如 sone00993） */
  publishNumber?: string;
  kind: string;
  title: string;
  titleZh?: string;
  plot?: string;
  originalPlot?: string;
  actors?: string[];
  genres?: string[];
  directors?: string[];
  studio?: string;
  publisher?: string;
  series?: string;
  premiered?: string;
  runtime?: number | null;
  score?: number | null;
  ratingValue?: number | null;
  ratingMax?: number;
  ratingSource?: string;
  votes?: string | null;
  coverUrl?: string | null;
  coverLocal?: string | null;
  extrafanartUrls?: string[];
  extrafanartLocal?: string[];
  trailerUrl?: string;
  website?: string;
  mosaic?: string;
  source: string;
  sourcesTried?: string[];
  fieldSources?: Record<string, string>;
  fieldTimings?: Array<{ field: string; source?: string; ms?: number }>;
  sourceRuns?: Array<{
    id: string;
    ok: boolean;
    ms: number;
    error?: string;
    channel: "fast" | "slow";
  }>;
  scrapedAt?: string;
  ok?: boolean;
  message?: string;
  sourceSnapshots?: Record<string, SourceSnapshotView>;
};

export type FileChangeEvent = {
  ids: number[];
  kind?: string;
  jobId?: string;
  reason?: "scan" | "scrape" | "organize" | "action" | "batch";
  ts: number;
};

export type IndexAllStatus = {
  running: boolean;
  kindTotal: number;
  kindIndex: number;
  currentKind?: string;
  currentLabel?: string;
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  message?: string;
  error?: string;
};
