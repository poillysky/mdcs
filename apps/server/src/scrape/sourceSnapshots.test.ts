import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSnapshotFieldValue, serializeSourceSnapshots } from "./sourceSnapshots.js";
import type { ProviderResult } from "./types.js";

describe("serializeSourceSnapshots", () => {
  it("keeps per-source field values for UI switching", () => {
    const bySource = new Map<string, ProviderResult>([
      [
        "fc2",
        {
          source: "fc2",
          ms: 10,
          fields: { title: "官方标题", studio: "卖家A", genres: ["素人"] },
          coverUrl: null,
        },
      ],
      [
        "fc2_hub",
        {
          source: "fc2_hub",
          ms: 20,
          fields: { title: "Hub 标题", studio: "卖家B", genres: ["ギャル"] },
          coverUrl: "https://contents-thumbnail2.fc2.com/sample.jpg",
          extrafanartUrls: ["https://contents-thumbnail2.fc2.com/a.jpg"],
        },
      ],
    ]);

    const snapshots = serializeSourceSnapshots(bySource);
    assert.equal(readSnapshotFieldValue(snapshots.fc2!, "title"), "官方标题");
    assert.equal(readSnapshotFieldValue(snapshots.fc2_hub!, "title"), "Hub 标题");
    assert.equal(readSnapshotFieldValue(snapshots.fc2_hub!, "coverUrl"), snapshots.fc2_hub!.coverUrl);
    assert.match(readSnapshotFieldValue(snapshots.fc2_hub!, "extrafanart"), /a\.jpg/);
  });
});
