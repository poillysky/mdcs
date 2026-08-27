import { loadScrapeConfig } from "../src/config/loadScrape.js";

const key = String(loadScrapeConfig(true).theporndbApiKey || "").trim();
const auth = key.toLowerCase().startsWith("bearer ") ? key : `Bearer ${key}`;

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://theporndb.net/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: "application/json",
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status} len=${text.length}`);
  console.log(text.slice(0, 500));
  console.log("");
}

await gql(`query { searchScene(term: "SONE-001", limit: 3) { id title date site { name } } }`);
await gql(`query { searchJAV(term: "SONE-001", limit: 3) { id title date site { name } } }`);
await gql(`query { findSceneByID(id: "SONE-001") { id title date } }`);
