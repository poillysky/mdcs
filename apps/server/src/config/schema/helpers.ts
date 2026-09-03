export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function toBooleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : [...fallback];
}

export function parseExtList(value: unknown, fallback: string[]): string[] {
  const list = parseStringList(value, fallback);
  return list.map((x) => x.replace(/^\./, "").toLowerCase());
}
