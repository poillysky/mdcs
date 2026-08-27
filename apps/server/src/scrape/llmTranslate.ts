import type { ScrapeConfig } from "./types.js";

export type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

const DEFAULT_TRANSLATE_SYSTEM = `你是影视元数据翻译助手。将用户给出的日文或其它语言文本翻译成简体中文。
只输出译文本身，不要解释，不要加引号或 markdown。
专有名词（演员名、片商名、番号）可保留原文或常用译名。`;

function normalizeBase(url: string): string {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

export function resolveLlmConfig(cfg: ScrapeConfig): LlmConfig {
  const llm = cfg.llm;
  return {
    baseUrl: normalizeBase(llm?.baseUrl || process.env.LLM_BASE_URL || ""),
    apiKey: String(llm?.apiKey || process.env.LLM_API_KEY || "").trim(),
    model: String(llm?.model || process.env.LLM_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini",
  };
}

export async function translateText(opts: {
  text: string;
  llm: LlmConfig;
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const text = String(opts.text || "").trim();
  if (!text) return "";
  if (!opts.llm.baseUrl) throw new Error("未配置 LLM Base URL");

  const res = await fetch(`${opts.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.llm.apiKey ? { Authorization: `Bearer ${opts.llm.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.llm.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: (opts.systemPrompt || "").trim() || DEFAULT_TRANSLATE_SYSTEM,
        },
        { role: "user", content: text },
      ],
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) throw new Error("LLM 未返回内容");
  return raw
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/** 粗判是否像中文（已译过则跳过） */
export function looksChinese(text: string): boolean {
  const s = String(text || "").trim();
  if (!s) return false;
  const cn = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const jaKana = (s.match(/[\u3040-\u30ff]/g) || []).length;
  return cn >= 2 && cn >= jaKana;
}
