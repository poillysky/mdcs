const FC2_PPV = /FC2[^A-Z\d]{0,5}PPV[^A-Z\d]{0,5}(\d{5,7})/i;
const FC2 = /FC2[^A-Z\d]{0,5}(\d{5,7})/i;
const HEYDOUGA_FULL = /(HEYDOUGA)[-_]*(\d{4})[-_]0?(\d{3,5})/i;
const HEYDOUGA_SHORT = /(?:HEY)[-_]*(\d{4})[-_]0?(\d{3,5})/i;
const GETCHU = /GETCHU[-_]*(\d+)/i;
const GYUTTO = /GYUTTO-(\d+)/i;
const LUXU259 = /259LUXU-(\d+)/i;
const DOMAIN = /\w{3,10}\.(COM|NET|APP|XYZ)/gi;
const MUGEN = /(MKB?D)[-_]*(S\d{2,3})|(MK3D2DBD|S2M|S2MBD)[-_]*(\d{2,3})/i;
const IBW_Z = /(IBW)[-_](\d{2,5}z)/i;
const STANDARD_SEP = /([A-Z]{2,10})[-_](\d{2,5})/i;
const TOKYO_HOT_COMPACT = /(RED[01]\d{2}|SKY[0-3]\d{2}|EX00[01]\d)/i;
const STANDARD_NOSEP = /([A-Z]{2,})(\d{2,5})/i;
const TMA = /(T[23]8[-_]\d{3})/;
const TOKYO_HOT_NK = /(N\d{4}|K\d{4})/i;
const R18 = /(R18-?\d{3})/i;
const NUMERIC_UNCENSORED = /(\d{6}[-_]\d{2,3})/;

export type IdentifyResult = {
  code: string | null;
  cdIndex: number;
};

function stripExt(fileName: string): string {
  return fileName.replace(/\.[^.\\/]+$/, "");
}

function extractCdIndex(base: string): { cleaned: string; cdIndex: number } {
  let cdIndex = 1;
  let cleaned = base;
  const m = cleaned.match(/(?:[-_]|^)(?:cd|disc|part)[-_]?(\d{1,2})\b/i);
  if (m) {
    cdIndex = Math.max(1, parseInt(m[1], 10) || 1);
    cleaned = cleaned.replace(m[0], " ");
  }
  return { cleaned, cdIndex };
}

function matchId(norm: string): string | null {
  if (norm.includes("FC2")) {
    const ppv = norm.match(FC2_PPV);
    if (ppv) return `FC2-PPV-${ppv[1]}`;
    const fc2 = norm.match(FC2);
    if (fc2) return `FC2-${fc2[1]}`;
  }

  if (norm.includes("HEYDOUGA")) {
    const m = norm.match(HEYDOUGA_FULL);
    if (m) return `${m[1].toUpperCase()}-${m[2]}-${m[3]}`;
  }

  if (norm.includes("GETCHU")) {
    const m = norm.match(GETCHU);
    if (m) return `GETCHU-${m[1]}`;
  }

  if (norm.includes("GYUTTO")) {
    const m = norm.match(GYUTTO);
    if (m) return `GYUTTO-${m[1]}`;
  }

  if (norm.includes("259LUXU")) {
    const m = norm.match(LUXU259);
    if (m) return `259LUXU-${m[1]}`;
  }

  const noDomain = norm.replace(DOMAIN, "");
  if (noDomain !== norm) {
    const nested = matchId(noDomain);
    if (nested) return nested;
  }

  const hey = norm.match(HEYDOUGA_SHORT);
  if (hey) return `HEYDOUGA-${hey[1]}-${hey[2]}`;

  const mugen = norm.match(MUGEN);
  if (mugen) {
    if (mugen[1]) return `${mugen[1].toUpperCase()}-${mugen[2].toUpperCase()}`;
    return `${mugen[3].toUpperCase()}-${mugen[4]}`;
  }

  const ibw = norm.match(IBW_Z);
  if (ibw) return `${ibw[1].toUpperCase()}-${ibw[2].toLowerCase()}`;

  const sep = norm.match(STANDARD_SEP);
  if (sep) return `${sep[1].toUpperCase()}-${sep[2]}`;

  const hot = norm.match(TOKYO_HOT_COMPACT);
  if (hot) return hot[1].toUpperCase();

  const nosep = norm.match(STANDARD_NOSEP);
  if (nosep) return `${nosep[1].toUpperCase()}-${nosep[2]}`;

  const tma = norm.match(TMA);
  if (tma) return tma[1].toUpperCase().replace("_", "-");

  const nk = norm.match(TOKYO_HOT_NK);
  if (nk) return nk[1].toUpperCase();

  const r18 = norm.match(R18);
  if (r18) {
    const raw = r18[1].toUpperCase();
    return raw.includes("-") ? raw : raw.replace(/^R18/, "R18-");
  }

  const num = norm.match(NUMERIC_UNCENSORED);
  if (num) return num[1].replace("_", "-");

  if (norm.includes(")(")) {
    return matchId(norm.replace(/\)\(/g, "-"));
  }

  return null;
}

/**
 * 从文件名识别番号（对齐 JavSP avid.get_id 关键规则 + MDCS FC2-PPV 变体）
 */
export function stripJunkFilters(fileName: string, filters: string[]): string {
  let out = fileName;
  for (const raw of filters) {
    const f = raw.trim();
    if (!f) continue;
    if (f.startsWith("r:")) {
      try {
        const re = new RegExp(f.slice(2), "gi");
        out = out.replace(re, " ");
      } catch {
        /* ignore invalid regex */
      }
    } else {
      out = out.split(f).join(" ");
    }
  }
  return out;
}

export function identifyFromFileName(fileName: string): IdentifyResult {
  const base = stripExt(fileName);
  const { cleaned, cdIndex } = extractCdIndex(base);
  const norm = cleaned.toUpperCase();
  const code = matchId(norm);
  return { code, cdIndex };
}

/** 供目录名回退识别（扫描器可选） */
export function identifyFromPath(filePath: string): IdentifyResult {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const file = parts.pop() ?? "";
  const fromFile = identifyFromFileName(file);
  if (fromFile.code) return fromFile;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const fromDir = identifyFromFileName(parts[i]);
    if (fromDir.code) return { code: fromDir.code, cdIndex: fromFile.cdIndex };
  }
  return { code: null, cdIndex: fromFile.cdIndex };
}
