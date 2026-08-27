/**
 * 一次性：拉 DMM GraphQL 原始响应，对照 MDCS 已查字段 vs API 可用字段。
 * 用法: npx tsx scripts/_diag-dmm-gql-raw.ts [cid]
 */
import { getNetworkConfig, loadScrapeConfig } from "../src/config/loadScrape.js";
import { applyProxy } from "../src/scrape/network/proxy.js";
import { prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

const cid = process.argv[2] || "sone00001";
const GQL = "https://api.video.dmm.co.jp/graphql";

/** MDCS 当前 query（与 dmm.ts 一致） */
const MDCS_QUERY = `
query ScrapDigitalContent($id: ID!) {
  ppvContent(id: $id) {
    id title description
    packageImage { largeUrl mediumUrl }
    sample2DMovie { highestMovieUrl hlsMovieUrl }
    sampleVRMovie { highestMovieUrl }
    deliveryStartDate makerReleasedAt duration
    actresses { name } series { name } maker { name } label { name }
    genres { name } directors { name }
  }
  reviewSummary(contentId: $id) { average }
}
`;

const PROBES = [
  {
    name: "sampleImages + reviewSummary.total",
    query: `query($id:ID!){ ppvContent(id:$id){ sampleImages{ number imageUrl } } reviewSummary(contentId:$id){ average total } }`,
  },
  {
    name: "ppvContent scalar extras",
    query: `query($id:ID!){ ppvContent(id:$id){ floor contentType makerContentId productId } }`,
  },
  {
    name: "packageImage only medium (fallback check)",
    query: `query($id:ID!){ ppvContent(id:$id){ packageImage{ mediumUrl largeUrl } } }`,
  },
];

async function gql(query: string, cookie?: string) {
  const { fetch } = await import("undici");
  const res = await fetch(GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://video.dmm.co.jp",
      Referer: `https://video.dmm.co.jp/av/content/?id=${cid}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ variables: { id: cid }, query }),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, json: { raw: text.slice(0, 500) } };
  }
}

function summarizeMdcsFields(data: Record<string, unknown>) {
  const hit = (data.ppvContent || {}) as Record<string, unknown>;
  const review = (data.reviewSummary || {}) as Record<string, unknown>;
  const nonEmpty = (v: unknown) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v as object).some((x) => x != null && x !== "");
    return String(v).trim().length > 0;
  };
  const fields: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(hit)) {
    fields[`ppvContent.${k}`] = nonEmpty(v);
  }
  for (const [k, v] of Object.entries(review)) {
    fields[`reviewSummary.${k}`] = nonEmpty(v);
  }
  return fields;
}

loadScrapeConfig(true);
applyProxy(getNetworkConfig().proxyUrl);
const site = await prepareProviderFetch("dmm", "https://www.dmm.co.jp");

console.log(`=== DMM GraphQL raw cid=${cid} ===\n`);

const mdcs = await gql(MDCS_QUERY, site.cookie);
console.log("[1] MDCS 当前 query 响应 status=", mdcs.status);
const mdcsData = (mdcs.json as { data?: Record<string, unknown> })?.data;
if (mdcsData) {
  console.log(JSON.stringify(mdcsData, null, 2));
  console.log("\n[1] 非空字段:");
  console.log(summarizeMdcsFields(mdcsData));
} else {
  console.log(JSON.stringify(mdcs.json, null, 2));
}

console.log("\n---\n");

for (const probe of PROBES) {
  console.log(`[2+] ${probe.name}`);
  const r = await gql(probe.query, site.cookie);
  console.log("status=", r.status);
  console.log(JSON.stringify(r.json, null, 2));
  console.log("");
}