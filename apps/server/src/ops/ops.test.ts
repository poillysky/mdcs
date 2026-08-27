import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderTemplate } from "./template.js";
import { normalizeOpsConfig, createDefaultOpsConfig } from "./types.js";
import { qbCategoryMatches, parseQbPayload } from "./qb.js";

describe("renderTemplate", () => {
  it("替换变量，缺失为空", () => {
    assert.equal(
      renderTemplate('{"e":"{{ event }}","t":"{{ title }}"}', { event: "finished" }),
      '{"e":"finished","t":""}',
    );
  });
});

describe("normalizeOpsConfig", () => {
  it("默认关闭监控与 Webhook", () => {
    const cfg = createDefaultOpsConfig();
    assert.equal(cfg.monitor.enabled, false);
    assert.equal(cfg.webhook.enabled, false);
    assert.equal(cfg.monitor.intervalSec, 30);
    assert.equal(cfg.qb.enabled, false);
    assert.equal(cfg.actors.source, "local");
    assert.deepEqual(cfg.presets, []);
  });

  it("规范化 endpoint 与 monitor entry", () => {
    const cfg = normalizeOpsConfig({
      monitor: {
        enabled: true,
        mode: "compat",
        intervalSec: 45,
        entries: [{ path: "inbox/有码", kinds: ["japan_censored"], jobMode: "full" }],
      },
      webhook: {
        enabled: true,
        endpoints: [
          {
            name: "Notify",
            url: "https://example.com/hook",
            events: ["finished", "failed"],
            timeoutSec: 8,
            retries: 2,
          },
        ],
      },
    });
    assert.equal(cfg.monitor.entries.length, 1);
    assert.ok(cfg.monitor.entries[0]!.id);
    assert.equal(cfg.webhook.endpoints[0]!.method, "POST");
    assert.equal(cfg.webhook.endpoints[0]!.retries, 2);
  });

  it("规范化预设与 lastJob", () => {
    const cfg = normalizeOpsConfig({
      presets: [{ name: "日常全量", kinds: ["*enabled"], mode: "full", dryRun: false }],
      lastJob: { kinds: ["japan_censored"], mode: "scrape_only", dryRun: true, options: {} },
    });
    assert.equal(cfg.presets.length, 1);
    assert.ok(cfg.presets[0]!.id);
    assert.equal(cfg.lastJob?.mode, "scrape_only");
    assert.equal(cfg.lastJob?.dryRun, true);
  });
});

describe("qb hook helpers", () => {
  it("空分类列表视为全匹配", () => {
    assert.equal(qbCategoryMatches([], "jav"), true);
  });

  it("分类大小写不敏感", () => {
    assert.equal(qbCategoryMatches(["JAV", "fc2"], "jav"), true);
    assert.equal(qbCategoryMatches(["JAV"], "other"), false);
  });

  it("解析 body / query 字段别名", () => {
    const p = parseQbPayload({ Category: "fc2", N: "foo" }, { F: "/data/x" });
    assert.equal(p.category, "fc2");
    assert.equal(p.name, "foo");
    assert.equal(p.savePath, "/data/x");
  });
});
