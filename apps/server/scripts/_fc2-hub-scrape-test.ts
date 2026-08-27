/** Live fc2_hub scrape timing probe — FC2-PPV-3275049 */
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fc2HubProvider } from "../src/scrape/providers/fc2_hub.js";

initScrapeNetworkStores();
const code = process.argv[2] || "FC2-PPV-3275049";
const t0 = Date.now();
console.log(`[fc2_hub] scrape ${code} …`);
try {
  const r = await fc2HubProvider.scrape({
    code,
    kind: "fc2",
    metaSources: ["fc2_hub"],
    coverSources: ["fc2_hub"],
    signal: AbortSignal.timeout(240_000),
  });
  console.log(`done ${Date.now() - t0}ms ok=${!r?.error}`);
  console.log(
    JSON.stringify(
      {
        error: r?.error,
        ms: r?.ms,
        title: r?.fields.title,
        coverUrl: r?.coverUrl,
        genres: r?.fields.genres?.slice(0, 5),
        trailerUrl: r?.fields.trailerUrl,
      },
      null,
      2,
    ),
  );
} finally {
  const { releaseFlareSession, recycleFlareSessions } = await import(
    "../src/scrape/network/flaresolverr.js"
  );
  await releaseFlareSession("script-done");
  await recycleFlareSessions({ keepOwned: false });
}