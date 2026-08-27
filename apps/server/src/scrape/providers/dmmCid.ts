/** DMM CID 识别 / 猜测（对齐 MDCX mdcx/crawlers/dmm_direct.py） */

const CID_IN_URL =
  /(?:pics\.dmm\.co\.jp|awsimgsrc\.dmm\.co\.jp|pics\.dmm\.com|jp\.netcdn\.space)\/(?:pics_dig\/)?digital\/video\/([a-z0-9]+)\/\1(?:pl|ps|jm)?\.(?:jpe?g|webp)/i;

const PREFIX_GROUPS: Record<string, string[]> = {
  "": [
    "adn", "bf", "cawd", "cnd", "dasd", "dvdms", "ebod", "eyan", "gdhh", "hibl", "hmn", "hnd", "hntd",
    "ipit", "ipvr", "ipx", "ipzz", "jue", "jufd", "juk", "jul", "jux", "juy", "juq", "kawd", "meyd",
    "miab", "miad", "mibd", "mide", "midv", "mifd", "mtsp", "mudr", "mukd", "mvsd", "mymd", "nima",
    "ofje", "onsd", "pred", "rki", "sone", "sora", "ssis", "ssni", "waaa",
  ],
  "1": [
    "dandy", "dism", "dldss", "dvdes", "fcdss", "fset", "fsdss", "gs", "hunt", "kmhrs", "mmgh", "rct",
    "rctd", "sdab", "sdam", "sdde", "sdjs", "sdmf", "sdmm", "sdms", "sdmt", "sdmu", "sdfk", "sdnm",
    "star", "stars", "start", "svdvd", "sw", "vandr",
  ],
  "3": ["wanz"],
  "13": ["ayb", "gg", "gvg", "gvh", "ovg"],
  "17": ["bkd"],
  "18": ["momj", "ntrd"],
  "41": ["dok"],
  "42": ["sma"],
  "49": ["avop", "madm"],
  "55": ["t28"],
  "77": ["cre"],
  "118": ["onez"],
  "143": ["ppd", "umd"],
  "433": ["mbd"],
  "436": ["abf"],
  "5642": ["hodv"],
  h_068: ["mxgs"],
  h_113: ["ggg"],
  h_205: ["ssnd"],
  h_491: ["fone"],
  h_1100: ["hzgd"],
  h_1240: ["milk"],
  h_1324: ["skmj"],
  h_1371: ["zmen"],
  h_1374: ["ksvr"],
  h_1454: ["bdsr", "husr"],
  h_189: ["ymd"],
  h_237: ["nact"],
  h_910: ["vrtm"],
  h_995: ["bokd"],
};

const EXTRA_PREFIXES: Record<string, string[]> = {
  sw: ["h_113"],
  bdsr: ["57"],
  husr: ["57"],
  sma: ["83"],
};

const SPECIAL_THRESHOLDS: Record<string, [number, string, string]> = {
  avop: [168, "", "1"],
  gigl: [643, "h_860", ""],
  ekdv: [655, "49", ""],
};

const COMMON_PREFIXES = ["", "1", "13", "49", "436", "118", "55", "57", "83", "5642"];

const DIGIT_SERIES = Object.values(PREFIX_GROUPS)
  .flat()
  .filter((s) => /\d/.test(s))
  .sort((a, b) => b.length - a.length);

function uniqueStrings(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function parseNumber(number: string): Array<[string, number, string]> {
  const cleaned = number.toLowerCase().trim().replace(/-/g, "").replace(/\s/g, "");
  for (const series of DIGIT_SERIES) {
    if (cleaned.startsWith(series)) {
      const rest = cleaned.slice(series.length);
      if (/^\d+$/.test(rest) && rest) {
        return [[series, Number(rest), String(Number(rest)).padStart(5, "0")]];
      }
    }
  }
  const m = cleaned.match(/^([a-z]+)(\d+)$/);
  if (!m) return [];
  const series = m[1]!;
  const digits = m[2]!;
  return [[series, Number(digits), String(Number(digits)).padStart(5, "0")]];
}

function prefixesFor(series: string, num: number): string[] {
  const extra = EXTRA_PREFIXES[series] ?? [];
  const special = SPECIAL_THRESHOLDS[series];
  if (special) {
    const [threshold, smallPrefix, largePrefix] = special;
    const prefix = num <= threshold ? smallPrefix : largePrefix;
    return uniqueStrings([prefix, ...extra]);
  }
  for (const [groupPrefix, members] of Object.entries(PREFIX_GROUPS)) {
    if (members.includes(series)) {
      return uniqueStrings([groupPrefix, "", ...extra]);
    }
  }
  return uniqueStrings([...COMMON_PREFIXES, ...extra]);
}

/** 对齐 MDCX generate_cid_candidates */
export function generateCidCandidates(numberRaw: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const [series, , padded] of parseNumber(numberRaw)) {
    for (const prefix of prefixesFor(series, Number.parseInt(padded, 10))) {
      const cid = `${prefix}${series}${padded}`;
      if (!seen.has(cid)) {
        seen.add(cid);
        candidates.push(cid);
      }
    }
  }
  return candidates;
}

export function extractDmmCidFromUrl(url: string | null | undefined): string | null {
  const s = String(url || "").trim();
  if (!s) return null;
  const m = s.match(CID_IN_URL);
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** 从番号猜 CID 候选（GraphQL / CDN 探测顺序） */
export function guessDmmCids(codeRaw: string): string[] {
  const code = String(codeRaw || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, "-");
  if (!code || /^FC2/i.test(code)) return [];
  if (!/^([A-Z0-9]{2,10})-(\d{1,6})$/i.test(code)) return [];
  return generateCidCandidates(code);
}

export function dmmCoverUrls(cid: string): {
  pl: string;
  ps: string;
  awsPl: string;
  awsPs: string;
} {
  const c = cid.toLowerCase();
  return {
    pl: `https://pics.dmm.co.jp/digital/video/${c}/${c}pl.jpg`,
    ps: `https://pics.dmm.co.jp/digital/video/${c}/${c}ps.jpg`,
    awsPl: `https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/${c}/${c}pl.jpg`,
    awsPs: `https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/${c}/${c}ps.jpg`,
  };
}
