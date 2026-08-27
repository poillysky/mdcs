/** 日志脱敏：避免 API Key / Token 进日志 */
export function redactSecrets(input: unknown): string {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  return text
    .replace(/(api[_-]?key|token|authorization|bearer)([="'\[\]:\s]+)([^\s"'&,}]+)/gi, "$1$2***")
    .replace(/sk-[a-zA-Z0-9]{8,}/g, "sk-***")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer ***");
}
