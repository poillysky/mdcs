import type {
  RecognitionKindKey,
  RecognitionWordsByKind,
  RecognitionWordsConfig,
} from "../../scrape/types.js";
import { isObject } from "./helpers.js";

export const RECOGNITION_KIND_KEYS: RecognitionKindKey[] = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
];

export function createDefaultRecognitionWords(): RecognitionWordsConfig {
  return { code: {}, path: {} };
}

export function parseRecognitionWordList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function normalizeRecognitionWordsByKind(raw: unknown): RecognitionWordsByKind {
  const out: RecognitionWordsByKind = {};
  if (!isObject(raw)) return out;
  for (const kind of RECOGNITION_KIND_KEYS) {
    const list = parseRecognitionWordList(raw[kind]);
    if (list.length) out[kind] = list;
  }
  return out;
}

export function normalizeRecognitionWords(raw: unknown, base: RecognitionWordsConfig): RecognitionWordsConfig {
  if (!isObject(raw)) return base;
  return {
    code: isObject(raw.code) ? normalizeRecognitionWordsByKind(raw.code) : base.code,
    path: isObject(raw.path) ? normalizeRecognitionWordsByKind(raw.path) : base.path,
  };
}
