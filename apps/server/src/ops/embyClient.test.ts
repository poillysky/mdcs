import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmbyApiUrl, embyAuthHeaders } from "./embyClient.js";
import { lookupGfriendsUrl, resolveActorMapInfo } from "./gfriends.js";
import { createDefaultOpsConfig, normalizeOpsConfig } from "./types.js";

describe("buildEmbyApiUrl", () => {
  it("补全 scheme 并加 /emby 前缀", () => {
    const u = buildEmbyApiUrl("192.168.1.10:8096", "/System/Info");
    assert.equal(u, "http://192.168.1.10:8096/emby/System/Info");
  });

  it("去掉末尾 /emby 再拼路径", () => {
    const u = buildEmbyApiUrl("http://host:8096/emby/", "/Persons", { personTypes: "Actor" });
    assert.match(u, /^http:\/\/host:8096\/emby\/Persons\?personTypes=Actor$/);
  });

  it("已有 /emby 路径不重复", () => {
    const u = buildEmbyApiUrl("http://h", "/emby/Library/Refresh");
    assert.equal(u, "http://h/emby/Library/Refresh");
  });
});

describe("embyAuthHeaders", () => {
  it("写入 MediaBrowser Token", () => {
    const h = embyAuthHeaders("secret-key");
    assert.equal(h.get("Authorization"), 'MediaBrowser Token="secret-key"');
    assert.equal(h.get("Accept"), "application/json");
  });
});

describe("lookupGfriendsUrl", () => {
  it("按名.jpg 匹配", () => {
    const map = new Map([["三上悠亜.jpg", "https://x/a.jpg"]]);
    assert.equal(lookupGfriendsUrl(map, "三上悠亜"), "https://x/a.jpg");
    assert.equal(lookupGfriendsUrl(map, "nobody"), null);
  });
});

describe("normalizeOpsConfig actors", () => {
  it("默认含 Emby 同步字段", () => {
    const a = createDefaultOpsConfig().actors;
    assert.equal(a.metadataOverwrite, "missing");
    assert.equal(a.scrapeImages, true);
    assert.deepEqual(a.libraryIds, []);
  });

  it("规范化覆盖模式与天数", () => {
    const cfg = normalizeOpsConfig({
      actors: {
        source: "emby",
        embyUrl: "http://x",
        metadataOverwrite: "all",
        autoScrapeRecentDays: 7.9,
        libraryIds: ["lib1", "", 1],
      },
    });
    assert.equal(cfg.actors.metadataOverwrite, "all");
    assert.equal(cfg.actors.autoScrapeRecentDays, 7);
    assert.deepEqual(cfg.actors.libraryIds, ["lib1"]);
  });
});

describe("resolveActorMapInfo", () => {
  it("无映射时回退原名", () => {
    const r = resolveActorMapInfo("__no_such_actor_zzzz__");
    assert.equal(r.name, "__no_such_actor_zzzz__");
    assert.equal(r.url, "");
  });
});
