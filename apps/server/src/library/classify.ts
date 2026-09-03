import type {
  RecognitionKindKey,
  RecognitionWordsByKind,
  RecognitionWordsConfig,
} from "../scrape/types.js";
import type { KindId } from "../types.js";

/** 对齐 DESIGN §4.7.10 / §5.2 命名字段 {mosaic} */
export type MosaicLabel = "有码" | "无码" | "无码破解" | "无码流出" | "";

export type ClassifyResult = {
  mosaic: MosaicLabel;
  /** 识别词 / 内置关键词建议的 Kind；扫描入库时写入 files.kind */
  suggestedKind?: KindId;
  matched: string[];
};

/** 扫描分区 kind + 识别结果 → 入库 kind */
export function resolveFileKind(partitionKind: KindId, classified: Pick<ClassifyResult, "suggestedKind">): KindId {
  const suggested = classified.suggestedKind;
  if (!suggested) return partitionKind;
  // 国产/欧美/FC2 分区扫描时，不被路径里泛义「无码」等日文区关键词覆盖
  if (
    (partitionKind === "china" || partitionKind === "western" || partitionKind === "fc2") &&
    (suggested === "japan_uncensored" ||
      suggested === "japan_censored" ||
      suggested === "japan_amateur" ||
      suggested === "japan_gravure")
  ) {
    return partitionKind;
  }
  return suggested;
}

const CRACK_WORDS = ["uncensored", "破解", "crack", "无码破解", "-uc", "_uc", "uc."];
const LEAK_WORDS = ["流出", "leaked", "leak", "无码流出", "盗撮流出"];
const UNCENSOR_WORDS = ["无码", "uncensored", "無碼", "carib", "caribbean", "1pondo", "heyzo", "tokyo-hot", "tokyohot"];
const CENSOR_WORDS = ["有码", "有碼", "censored"];

/** 番号前缀识别顺序（更专一的厂牌/系列优先） */
const CODE_RECOGNITION_KIND_ORDER: RecognitionKindKey[] = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
];

/** 路径关键词识别顺序（国产/欧美优先于泛义「无码」） */
const PATH_RECOGNITION_KIND_ORDER: RecognitionKindKey[] = [
  "fc2",
  "china",
  "western",
  "japan_amateur",
  "japan_gravure",
  "japan_censored",
  "japan_uncensored",
];

const KIND_HINTS: Array<{ kind: KindId; words: string[] }> = [
  { kind: "fc2", words: ["fc2", "fc2-ppv", "fc2ppv"] },
  { kind: "china", words: ["国产无码", "国产", "國產", "麻豆", "madou", "gvg"] },
  { kind: "western", words: ["western", "欧美", "theporndb", "tpdb"] },
  { kind: "japan_amateur", words: ["素人", "amateur", "siro"] },
  { kind: "japan_gravure", words: ["写真", "gravure", "image.tv", "iv"] },
  { kind: "japan_censored", words: ["有码", "有碼", "censored"] },
  { kind: "japan_uncensored", words: ["无码", "無碼", "uncensored", "carib", "1pondo", "heyzo"] },
];

function haystack(sourcePath: string, fileName: string, code?: string | null): string {
  return `${sourcePath} ${fileName} ${code || ""}`.toLowerCase();
}

function includesAny(text: string, words: string[]): string | undefined {
  for (const w of words) {
    if (text.includes(w.toLowerCase())) return w;
  }
  return undefined;
}

function matchCustomCodeKind(
  code: string | null | undefined,
  wordsByKind: RecognitionWordsByKind | undefined,
): { kind: KindId; word: string } | undefined {
  if (!code || !wordsByKind) return undefined;
  const upper = code.toUpperCase();
  for (const key of CODE_RECOGNITION_KIND_ORDER) {
    const words = wordsByKind[key];
    if (!words?.length) continue;
    for (const raw of words) {
      const prefix = raw.trim();
      if (!prefix) continue;
      if (upper.startsWith(prefix.toUpperCase())) {
        return { kind: key, word: prefix };
      }
    }
  }
  return undefined;
}

function matchCustomPathKind(
  sourcePath: string,
  fileName: string,
  wordsByKind: RecognitionWordsByKind | undefined,
): { kind: KindId; word: string } | undefined {
  if (!wordsByKind) return undefined;
  const text = haystack(sourcePath, fileName, null);
  for (const key of PATH_RECOGNITION_KIND_ORDER) {
    const words = wordsByKind[key];
    if (!words?.length) continue;
    for (const raw of words) {
      const word = raw.trim();
      if (!word) continue;
      const hit = includesAny(text, [word]);
      if (hit) return { kind: key, word: hit };
    }
  }
  return undefined;
}

/**
 * 从路径/文件名/番号推断 mosaic 与建议 Kind。
 * 优先级：破解 > 流出 > 无码 > 有码；Kind 为自定义番号 > 自定义路径 > 内置关键词。
 */
export function classifyFromPath(
  sourcePath: string,
  fileName: string,
  code?: string | null,
  crackKeywords?: string[],
  recognitionWords?: RecognitionWordsConfig,
): ClassifyResult {
  const text = haystack(sourcePath, fileName, code);
  const matched: string[] = [];

  const crackWords = crackKeywords?.length ? crackKeywords : CRACK_WORDS;
  const crack = includesAny(text, crackWords);
  const leak = includesAny(text, LEAK_WORDS);
  const unc = includesAny(text, UNCENSOR_WORDS);
  const cen = includesAny(text, CENSOR_WORDS);

  let mosaic: MosaicLabel = "";
  if (crack) {
    mosaic = "无码破解";
    matched.push(crack);
  } else if (leak) {
    mosaic = "无码流出";
    matched.push(leak);
  } else if (unc) {
    mosaic = "无码";
    matched.push(unc);
  } else if (cen) {
    mosaic = "有码";
    matched.push(cen);
  }

  let suggestedKind: KindId | undefined;
  const codeHit = matchCustomCodeKind(code, recognitionWords?.code);
  if (codeHit) {
    suggestedKind = codeHit.kind;
    matched.push(codeHit.word);
  } else {
    const pathHit = matchCustomPathKind(sourcePath, fileName, recognitionWords?.path);
    if (pathHit) {
      suggestedKind = pathHit.kind;
      if (!matched.includes(pathHit.word)) matched.push(pathHit.word);
    }
  }

  if (!suggestedKind) {
    for (const hint of KIND_HINTS) {
      const hit = includesAny(text, hint.words);
      if (hit) {
        suggestedKind = hint.kind;
        if (!matched.includes(hit)) matched.push(hit);
        break;
      }
    }
  }

  if (code && /^FC2/i.test(code) && !suggestedKind) {
    suggestedKind = "fc2";
    matched.push("FC2");
  }

  return { mosaic, suggestedKind, matched };
}
