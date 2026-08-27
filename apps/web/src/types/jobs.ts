export type JobRow = {
  id: string;
  kinds: string[];
  mode: string;
  status: string;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  message?: string;
  dryRun?: boolean;
  options?: Record<string, unknown>;
  triggerSource?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type JobEvent = {
  ts: string;
  level: "info" | "ok" | "warn" | "error";
  text: string;
  jobId?: string;
  kind?: string;
};

export type JobPreset = {
  id: string;
  name: string;
  kinds: string[];
  mode: string;
  dryRun: boolean;
  options: Record<string, unknown>;
  updatedAt: number;
};

export type LastJobSnapshot = {
  kinds: string[];
  mode: string;
  dryRun: boolean;
  options: Record<string, unknown>;
  savedAt: number;
};
