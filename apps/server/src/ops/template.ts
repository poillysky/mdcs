/** 简易 {{ var }} 模板；缺失变量渲染为空串（对齐 MDC Jinja2 缺省行为） */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

export function renderUrl(
  url: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return renderTemplate(url, vars);
}
