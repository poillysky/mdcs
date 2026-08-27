/** 用系统设置里的 LLM（localStorage）把自然语言转成 Jinja2 命名模板 */

const SYSTEM = `你是媒体库命名模板助手。根据用户的中文描述，只输出一条命名模板，不要解释。
可用变量：number, publish_number, series_name, serial_number, first_letter, series, category, actor, first_actor, title, originaltitle, year, director, studio, publisher, runtime, release, source_filename, filename, source_path, subtitle, mosaic, resolution, part。
优先输出 Jinja2（{{ field }} / {% if %} / filter）；也可混写基础 {field}。
常用 filter：default、upper、lower、truncate、split、first、last、replace、trim。
只输出模板字符串本身，不要用 markdown 代码块。`;

const LLM_KEYS = {
  baseUrl: ["mdcs.llm.baseUrl", "scrap.llm.baseUrl"],
  apiKey: ["mdcs.llm.apiKey", "scrap.llm.apiKey"],
  model: ["mdcs.llm.model", "scrap.llm.model"],
} as const;

function readLlm(field: keyof typeof LLM_KEYS): string {
  for (const key of LLM_KEYS[field]) {
    const v = localStorage.getItem(key)?.trim();
    if (v) return v;
  }
  return "";
}

export function hasLlmConfigured(): boolean {
  return Boolean(readLlm("baseUrl"));
}

export async function generateNamingTemplate(userPrompt: string, fieldHint: string): Promise<string> {
  const base = readLlm("baseUrl").replace(/\/$/, "");
  const apiKey = readLlm("apiKey");
  const model = readLlm("model") || "gpt-4o-mini";
  if (!base) throw new Error("请先在「系统」设置中配置 LLM Base URL");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `字段用途：${fieldHint}\n用户需求：${userPrompt}\n请输出模板：`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
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
