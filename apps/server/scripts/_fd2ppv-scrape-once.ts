import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { fd2ppvProvider } from "../src/scrape/providers/fd2ppv.js";

initScrapeNetworkStores();
const r = await fd2ppvProvider.scrape({
  code: "FC2-PPV-3275049",
  kind: "fc2",
  metaSources: ["fd2ppv"],
  coverSources: ["fd2ppv"],
  signal: AbortSignal.timeout(90000),
});
console.log(
  JSON.stringify(
    {
      err: r?.error,
      ms: r?.ms,
      title: r?.fields.title?.slice(0, 40),
      cover: Boolean(r?.coverUrl),
      actors: r?.fields.actors,
      genresN: r?.fields.genres?.length,
    },
    null,
    2,
  ),
);
