/** API 错误码 — 与 docs/UI-COPY.md §12 对齐 */
export const API_CODES = {
  bad_request: "bad_request",
  not_found: "not_found",
  internal_error: "internal_error",
  kind_not_found: "kind_not_found",
  kind_unavailable: "kind_unavailable",
  kind_update_invalid: "kind_update_invalid",
  job_not_found: "job_not_found",
  job_create_invalid: "job_create_invalid",
  scan_failed: "scan_failed",
  path_not_allowed: "path_not_allowed",
  scrape_disabled: "scrape_disabled",
  missing_code: "missing_code",
  invalid_kind: "invalid_kind",
  no_cache: "no_cache",
  config_invalid: "config_invalid",
} as const;

export type ApiErrorCode = (typeof API_CODES)[keyof typeof API_CODES];
