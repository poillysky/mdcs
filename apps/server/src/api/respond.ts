import type { ApiResponse } from "../types.js";

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function fail(message: string, status = 400, code = "bad_request"): ApiResponse {
  return { ok: false, message, code };
}

export function sendOk<T>(res: import("express").Response, data: T) {
  res.json(ok(data));
}

export function sendFail(
  res: import("express").Response,
  message: string,
  status = 400,
  code = "bad_request",
) {
  res.status(status).json(fail(message, status, code));
}
