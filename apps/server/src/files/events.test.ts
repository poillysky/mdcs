import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifyFileChanges, onFileChange } from "./events.js";

describe("file events", () => {
  it("debounces rapid updates into one batch", async () => {
    const events: number[][] = [];
    const off = onFileChange((e) => events.push(e.ids));
    notifyFileChanges(1, { reason: "scrape" });
    notifyFileChanges(2, { reason: "scrape" });
    notifyFileChanges(3, { reason: "scrape" });
    assert.equal(events.length, 0);
    await new Promise((r) => setTimeout(r, 280));
    assert.equal(events.length, 1);
    assert.deepEqual(new Set(events[0]), new Set([1, 2, 3]));
    off();
  });
});
