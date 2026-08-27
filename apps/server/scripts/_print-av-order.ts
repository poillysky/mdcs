import { SOURCE_CATALOG } from "../src/scrape/providers/catalog.js";
import { sortProviderCatalogEntries } from "../src/scrape/providers/catalogTypes.js";

const av = sortProviderCatalogEntries(SOURCE_CATALOG.filter((e) => e.group === "av"));
av.forEach((e, i) => console.log(`${i + 1}. ${e.id} (${e.label})`));
