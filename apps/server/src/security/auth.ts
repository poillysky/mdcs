import type { NextFunction, Request, Response } from "express";

/**
 * 可选局域网鉴权：设置环境变量 MDCS_API_TOKEN 后，
 * 除 /health 外需带 Header `X-Mdcs-Token: <token>` 或 `Authorization: Bearer <token>`。
 */
export function optionalApiAuth(req: Request, res: Response, next: NextFunction): void {
  const token = String(process.env.MDCS_API_TOKEN || "").trim();
  if (!token) {
    next();
    return;
  }
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const path = req.path || "";
  if (path === "/health" || path.startsWith("/health")) {
    next();
    return;
  }
  const header =
    String(req.headers["x-mdcs-token"] || "").trim() ||
    String(req.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
  if (header !== token) {
    res.status(401).json({
      ok: false,
      code: "unauthorized",
      message: "未授权：请配置正确的 API Token",
    });
    return;
  }
  next();
}
