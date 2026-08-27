import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { probeProvider } from "../src/scrape/probe.js";
import { fetchPageForSite, prepareProviderFetch } from "../src/scrape/providers/providerSite.js";

async function main() {
  initScrapeNetworkStores();
  const probe = await probeProvider("miss_av", { timeoutSec: 45 });
  console.log("PROBE", JSON.stringify(probe, null, 2));

  const site = await prepareProviderFetch("miss_av", "https://missav123.com");
  const url = `${site.baseUrl.replace(/\/$/, "")}/cn/sone-001`;
  const warm = await fetchPageForSite(url, site, {
    referer: `${site.baseUrl}/cn/`,
    timeoutMs: 45000,
    viaFlare: false,
    strictTimeout: true,
  });
  console.log("WARM_DIRECT", {
    via: warm?.via,
    len: warm?.html?.length ?? 0,
    finalUrl: warm?.finalUrl,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
