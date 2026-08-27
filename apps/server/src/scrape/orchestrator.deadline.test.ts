import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrapeProviderWithDeadline } from "./orchestrator.js";

describe("scrapeProviderWithDeadline", () => {
  it("fails fast when provider exceeds deadline", async () => {
    const started = Date.now();
    const result = await scrapeProviderWithDeadline(
      async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 5000);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(new Error("aborted"));
            },
            { once: true },
          );
        });
        return { source: "x", fields: {}, ms: 5000 };
      },
      { deadlineMs: 80 },
    );
    const elapsed = Date.now() - started;
    assert.ok(result);
    assert.match(String(result!.error || ""), /超时/);
    assert.ok(elapsed < 1000, `elapsed=${elapsed}`);
  });

  it("returns provider result when finished in time", async () => {
    const result = await scrapeProviderWithDeadline(
      async () => ({ source: "x", fields: { title: "ok" }, ms: 5 }),
      { deadlineMs: 1000 },
    );
    assert.equal(result?.fields.title, "ok");
    assert.equal(result?.error, undefined);
  });
});
