export type TabId = "config" | "sources" | "jobs" | "live";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
};

export type HealthInfo = {
  service: string;
  version: string;
  phase: string;
  projectRoot?: string;
  kinds?: number;
};
