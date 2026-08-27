import { getNetworkConfig } from "../../config/loadScrape.js";
import { flareGet, normalizeFlareUrl } from "./flare.js";
import { applyProxy, getActiveProxy, normalizeProxyUrl, undiciGet } from "./proxy.js";

export type NetworkTestTarget = "direct" | "proxy" | "flare";

export type NetworkTestInput = {
  target: NetworkTestTarget;
  proxyUrl?: string;
  flareSolverrUrl?: string;
  timeoutSec?: number;
};

export type NetworkTestResult = {
  ok: boolean;
  target: NetworkTestTarget;
  message: string;
  ms: number;
};

const DIRECT_PROBE = "https://www.javbus.com/";

function timeoutMs(sec?: number) {
  const s = sec && sec > 0 ? sec : 30;
  return Math.min(120, Math.max(3, s)) * 1000;
}

export async function testNetworkConnection(input: NetworkTestInput): Promise<NetworkTestResult> {
  const started = Date.now();
  const ms = () => Date.now() - started;
  const cfg = getNetworkConfig();
  const timeout = timeoutMs(input.timeoutSec ?? cfg.requestTimeoutSec);

  if (input.target === "flare") {
    const flareUrl = normalizeFlareUrl(input.flareSolverrUrl ?? cfg.flareSolverrUrl);
    if (!flareUrl) {
      return { ok: false, target: "flare", message: "请先填写 FlareSolverr 地址", ms: ms() };
    }
    try {
      const res = await fetch(flareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.list" }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        return {
          ok: false,
          target: "flare",
          message: `FlareSolverr 返回 HTTP ${res.status}`,
          ms: ms(),
        };
      }
      const json = (await res.json()) as { status?: string; message?: string };
      if (json.status && json.status !== "ok") {
        return {
          ok: false,
          target: "flare",
          message: json.message ?? `FlareSolverr 状态异常：${json.status}`,
          ms: ms(),
        };
      }
      // 额外探活：request.get 探测页（失败不阻断「服务可达」结论）
      const probe = await flareGet(DIRECT_PROBE, {
        flareUrl,
        timeoutMs: Math.min(timeout, 45_000),
      });
      const extra = probe.ok ? `，页面探活成功（${probe.ms}ms）` : `，页面探活未通过：${probe.error ?? "未知"}`;
      return {
        ok: true,
        target: "flare",
        message: `FlareSolverr 连接正常${extra}`,
        ms: ms(),
      };
    } catch (err) {
      return {
        ok: false,
        target: "flare",
        message: err instanceof Error ? err.message : String(err),
        ms: ms(),
      };
    }
  }

  if (input.target === "proxy") {
    const proxy = normalizeProxyUrl(input.proxyUrl ?? cfg.proxyUrl);
    if (!proxy) {
      return { ok: false, target: "proxy", message: "请先填写代理 URL", ms: ms() };
    }
    const applied = applyProxy(proxy);
    if (!applied.ok) {
      return {
        ok: false,
        target: "proxy",
        message: applied.error ?? "代理无效",
        ms: ms(),
      };
    }
    try {
      const res = await undiciGet(DIRECT_PROBE, {
        method: "HEAD",
        signal: AbortSignal.timeout(timeout),
        headers: { "user-agent": "MDCS-Network-Test/1.0" },
      });
      const ok = res.ok || res.status === 403 || res.status === 301 || res.status === 302;
      return {
        ok,
        target: "proxy",
        message: ok
          ? `经代理 ${getActiveProxy()} 可达 javbus（HTTP ${res.status}）`
          : `经代理访问返回 HTTP ${res.status}`,
        ms: ms(),
      };
    } catch (err) {
      return {
        ok: false,
        target: "proxy",
        message: err instanceof Error ? err.message : String(err),
        ms: ms(),
      };
    }
  }

  // direct：临时清代理测直连，测完恢复配置代理
  const previous = getActiveProxy();
  applyProxy("");
  try {
    const res = await undiciGet(DIRECT_PROBE, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeout),
      headers: { "user-agent": "MDCS-Network-Test/1.0" },
    });
    const ok = res.ok || res.status === 403 || res.status === 301 || res.status === 302;
    return {
      ok,
      target: "direct",
      message: ok
        ? `直连可达 javbus（HTTP ${res.status}）`
        : `直连返回 HTTP ${res.status}`,
      ms: ms(),
    };
  } catch (err) {
    return {
      ok: false,
      target: "direct",
      message: err instanceof Error ? err.message : String(err),
      ms: ms(),
    };
  } finally {
    applyProxy(previous || cfg.proxyUrl);
  }
}
