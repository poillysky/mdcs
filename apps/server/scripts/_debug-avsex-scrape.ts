import { avsexProvider } from "../src/scrape/providers/avsex.js";

const r = await avsexProvider.scrape({ code: "SONE-001" });
console.log(JSON.stringify(r, null, 2));
