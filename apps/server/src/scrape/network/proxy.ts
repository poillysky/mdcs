import { Agent, ProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from "undici";

let activeProxy = "";

export function getActiveProxy(): string {
  return activeProxy;
}

/** 允许 host:port / 缺省 scheme；空=直连 */
export function normalizeProxyUrl(raw: string | null | undefined): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  s = s.replace(/\/+$/, "");
  try {
    // eslint-disable-next-line no-new
    new URL(s);
  } catch {
    return "";
  }
  return s;
}

export function applyProxy(url: string | null | undefined): {
  ok: boolean;
  proxyUrl: string;
  error?: string;
} {
  const trimmed = normalizeProxyUrl(url);
  if (!trimmed) {
    setGlobalDispatcher(new Agent());
    activeProxy = "";
    const had = String(url || "").trim();
    if (had) {
      return { ok: false, proxyUrl: "", error: `代理地址无效：${had}` };
    }
    return { ok: true, proxyUrl: "" };
  }
  try {
    setGlobalDispatcher(new ProxyAgent(trimmed));
    activeProxy = trimmed;
    return { ok: true, proxyUrl: trimmed };
  } catch (e) {
    setGlobalDispatcher(new Agent());
    activeProxy = "";
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, proxyUrl: "", error: msg };
  }
}

export function undiciGet(
  url: string,
  init?: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
    method?: string;
  },
) {
  return undiciFetch(url, {
    method: init?.method ?? "GET",
    signal: init?.signal,
    headers: init?.headers,
    redirect: "follow",
  });
}
