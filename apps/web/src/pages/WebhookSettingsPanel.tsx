import { useEffect, useState, type ReactNode } from "react";
import { fetchOpsConfig, saveOpsConfig, testWebhookEndpoint } from "../api";
import { SettingRow } from "../components/SettingRow";
import { COPY } from "../lib/messages";
import { kindLabel } from "../lib/labels";
import type { NotifyFn } from "../lib/notify";
import type { KindRow, OpsConfig, WebhookEndpoint } from "../types";

type Props = {
  kinds: KindRow[];
  notify: NotifyFn;
};

const DEFAULT_BODY = `{
  "event": "{{ event }}",
  "data": {
    "task_id": "{{ task_id }}",
    "number": "{{ number }}",
    "title": "{{ title }}",
    "actor": "{{ actor }}",
    "error_message": "{{ error_message }}"
  }
}`;

const BODY_VARS: { group: string; items: string }[] = [
  { group: "事件", items: "event · timestamp · started_at" },
  { group: "任务", items: "task_id · duration · source_path · target_path · error_message" },
  {
    group: "刮削",
    items: "number · title · actor · first_actor · category · tags · outline · thumb · poster · mosaic",
  },
];

const DEFAULT_TEST_VARS = `number=SSIS-001
title=Webhook 测试标题
actor=测试演员`;

function newEndpoint(): WebhookEndpoint {
  return {
    id: `wh_${Date.now().toString(36)}`,
    name: "New Endpoint",
    method: "POST",
    url: "https://api.example.com/webhook",
    events: ["finished"],
    kinds: [],
    headers: [],
    bodyTemplate: DEFAULT_BODY,
    timeoutSec: 10,
    retries: 1,
  };
}

function parseTestVars(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function Section({
  title,
  hint,
  extra,
  children,
}: {
  title: string;
  hint?: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="set-section">
      <div className="set-section-head wh-section-head">
        <div className="wh-section-head-main">
          <div className="set-section-title">{title}</div>
          {hint ? <p className="set-section-sub">{hint}</p> : null}
        </div>
        {extra ? <div className="wh-section-head-extra">{extra}</div> : null}
      </div>
      {children != null ? <div className="set-section-body">{children}</div> : null}
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function WebhookSettingsPanel({ kinds, notify }: Props) {
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [openTestVars, setOpenTestVars] = useState<Record<string, boolean>>({});
  const [testVarsText, setTestVarsText] = useState<Record<string, string>>({});
  const [showVarsHelp, setShowVarsHelp] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchOpsConfig();
        setConfig(data.config);
      } catch (e) {
        notify("error", e, "加载 Webhook 配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  function patchWebhook(partial: Partial<OpsConfig["webhook"]>) {
    if (!config) return;
    setConfig({ ...config, webhook: { ...config.webhook, ...partial } });
  }

  function patchEndpoint(id: string, partial: Partial<WebhookEndpoint>) {
    if (!config) return;
    patchWebhook({
      endpoints: config.webhook.endpoints.map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await saveOpsConfig(config);
      setConfig(saved);
      notify("ok", "Webhook 配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function test(ep: WebhookEndpoint) {
    setTestingId(ep.id);
    try {
      const vars = parseTestVars(testVarsText[ep.id] ?? DEFAULT_TEST_VARS);
      const r = await testWebhookEndpoint({
        endpointId: ep.id,
        endpoint: ep,
        vars,
      });
      notify(r.ok ? "ok" : "warn", `${r.message}（${r.ms}ms）`);
    } catch (e) {
      notify("error", e, "测试失败");
    } finally {
      setTestingId(null);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载 Webhook 配置…</div>;
  }

  const wh = config.webhook;
  const dimmed = !wh.enabled;

  return (
    <div className="webhook-settings">
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">Webhook</h3>
        </header>
        <div className="mon-panel-body">
          <Section
            title="启用 Webhook"
            hint="开启后，刮削任务完成或失败时发送 HTTP 通知"
            extra={<Switch checked={wh.enabled} onChange={(v) => patchWebhook({ enabled: v })} />}
          />

          <div className={dimmed ? "wh-endpoints is-dimmed" : "wh-endpoints"}>
            {wh.endpoints.length === 0 ? (
              <div className="empty-block wh-empty">尚未添加 Endpoint</div>
            ) : null}

            {wh.endpoints.map((ep, idx) => {
              const testOpen = Boolean(openTestVars[ep.id]);
              return (
                <Section
                  key={ep.id}
                  title={ep.name.trim() || `Endpoint ${idx + 1}`}
                  hint={`${ep.method} · ${ep.url || "未填写 URL"}`}
                  extra={
                    <button
                      type="button"
                      className="btn sm ghost"
                      title="删除"
                      onClick={() =>
                        patchWebhook({
                          endpoints: wh.endpoints.filter((x) => x.id !== ep.id),
                        })
                      }
                    >
                      删除
                    </button>
                  }
                >
                  <SettingRow label="名称" hint="便于识别的 Endpoint 名称">
                    <input
                      className="org-input"
                      value={ep.name}
                      onChange={(e) => patchEndpoint(ep.id, { name: e.target.value })}
                      placeholder="New Endpoint"
                    />
                  </SettingRow>
                  <SettingRow label="请求方式">
                    <select
                      className="org-select"
                      value={ep.method}
                      onChange={(e) =>
                        patchEndpoint(ep.id, {
                          method: e.target.value as WebhookEndpoint["method"],
                        })
                      }
                    >
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="GET">GET</option>
                    </select>
                  </SettingRow>
                  <SettingRow
                    label="URL"
                    hint="支持模板变量，如 {{ number }}"
                    layout="stack"
                  >
                    <input
                      className="org-input"
                      value={ep.url}
                      onChange={(e) => patchEndpoint(ep.id, { url: e.target.value })}
                      placeholder="https://api.example.com/webhook"
                      spellCheck={false}
                    />
                  </SettingRow>

                  <SettingRow label="触发事件" hint="任务结束时按勾选事件派发" layout="stack">
                    <div className="nfo-check-grid wh-event-grid">
                      <label className="nfo-check">
                        <input
                          type="checkbox"
                          checked={ep.events.includes("finished")}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...new Set([...ep.events, "finished" as const])]
                              : ep.events.filter((x) => x !== "finished");
                            patchEndpoint(ep.id, {
                              events: next.length ? next : ["finished"],
                            });
                          }}
                        />
                        <span className="nfo-check-mark" aria-hidden />
                        <span className="nfo-check-text">刮削成功 (finished)</span>
                      </label>
                      <label className="nfo-check">
                        <input
                          type="checkbox"
                          checked={ep.events.includes("failed")}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...new Set([...ep.events, "failed" as const])]
                              : ep.events.filter((x) => x !== "failed");
                            patchEndpoint(ep.id, { events: next });
                          }}
                        />
                        <span className="nfo-check-mark" aria-hidden />
                        <span className="nfo-check-text">刮削失败 (failed)</span>
                      </label>
                    </div>
                  </SettingRow>

                  <SettingRow
                    label="触发分区"
                    hint="不选 = 全部；选中后仅这些 Kind 触发"
                    layout="stack"
                  >
                    <div className="chip-grid">
                      {kinds.map((k) => {
                        const on = ep.kinds.includes(k.id);
                        return (
                          <button
                            key={k.id}
                            type="button"
                            className={`chip${on ? " active" : ""}`}
                            onClick={() => {
                              const next = on
                                ? ep.kinds.filter((id) => id !== k.id)
                                : [...ep.kinds, k.id];
                              patchEndpoint(ep.id, { kinds: next });
                            }}
                          >
                            {kindLabel(k.id) || k.label}
                          </button>
                        );
                      })}
                    </div>
                  </SettingRow>

                  <SettingRow label="请求头" hint="Key-Value；值支持模板变量" layout="stack">
                    <div className="wh-headers">
                      {ep.headers.map((h, hIdx) => (
                        <div key={hIdx} className="wh-header-row">
                          <input
                            className="org-input"
                            placeholder="Key"
                            value={h.key}
                            onChange={(e) => {
                              const headers = ep.headers.map((x, i) =>
                                i === hIdx ? { ...x, key: e.target.value } : x,
                              );
                              patchEndpoint(ep.id, { headers });
                            }}
                          />
                          <input
                            className="org-input"
                            placeholder="Value"
                            value={h.value}
                            onChange={(e) => {
                              const headers = ep.headers.map((x, i) =>
                                i === hIdx ? { ...x, value: e.target.value } : x,
                              );
                              patchEndpoint(ep.id, { headers });
                            }}
                          />
                          <button
                            type="button"
                            className="btn sm ghost"
                            onClick={() =>
                              patchEndpoint(ep.id, {
                                headers: ep.headers.filter((_, i) => i !== hIdx),
                              })
                            }
                          >
                            删
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() =>
                          patchEndpoint(ep.id, {
                            headers: [...ep.headers, { key: "", value: "" }],
                          })
                        }
                      >
                        + 添加请求头
                      </button>
                    </div>
                  </SettingRow>

                  <SettingRow
                    label="Body 模板"
                    hint="JSON；GET 请求不发送 Body"
                    layout="stack"
                  >
                    <textarea
                      className="org-textarea wh-body"
                      rows={9}
                      value={ep.bodyTemplate}
                      onChange={(e) => patchEndpoint(ep.id, { bodyTemplate: e.target.value })}
                      spellCheck={false}
                    />
                  </SettingRow>

                  <SettingRow label="超时（秒）" hint="单次请求超时">
                    <input
                      className="org-input-sm"
                      type="number"
                      min={3}
                      max={120}
                      value={ep.timeoutSec}
                      onChange={(e) =>
                        patchEndpoint(ep.id, {
                          timeoutSec: Math.min(120, Math.max(3, Number(e.target.value) || 10)),
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="失败重试" hint="失败后再试次数（不含首次）">
                    <input
                      className="org-input-sm"
                      type="number"
                      min={0}
                      max={5}
                      value={ep.retries}
                      onChange={(e) =>
                        patchEndpoint(ep.id, {
                          retries: Math.min(5, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </SettingRow>

                  <div className="wh-test-block">
                    <button
                      type="button"
                      className="wh-fold-btn"
                      onClick={() =>
                        setOpenTestVars((m) => ({ ...m, [ep.id]: !m[ep.id] }))
                      }
                    >
                      {testOpen ? "收起自定义测试变量" : "展开自定义测试变量"}
                    </button>
                    {testOpen ? (
                      <textarea
                        className="org-textarea wh-test-vars"
                        rows={4}
                        value={testVarsText[ep.id] ?? DEFAULT_TEST_VARS}
                        onChange={(e) =>
                          setTestVarsText((m) => ({ ...m, [ep.id]: e.target.value }))
                        }
                        placeholder={"每行 key=value，如 number=SSIS-001"}
                        spellCheck={false}
                      />
                    ) : null}
                    <div className="wh-ep-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={testingId === ep.id}
                        onClick={() => void test(ep)}
                      >
                        {testingId === ep.id ? "测试中…" : "测试连接"}
                      </button>
                    </div>
                  </div>
                </Section>
              );
            })}

            <div className="wh-add-row">
              <button
                type="button"
                className="btn"
                onClick={() => patchWebhook({ endpoints: [...wh.endpoints, newEndpoint()] })}
              >
                + 添加 Endpoint
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowVarsHelp((v) => !v)}
              >
                {showVarsHelp ? "收起 Body 变量说明" : "Body 变量说明"}
              </button>
            </div>
            {showVarsHelp ? (
              <div className="wh-vars-block">
                <div className="wh-vars-table">
                  {BODY_VARS.map((row) => (
                    <div key={row.group} className="wh-vars-row">
                      <span className="wh-vars-group">{row.group}</span>
                      <code className="wh-vars-items">{row.items}</code>
                    </div>
                  ))}
                  <p className="wh-vars-note">
                    URL / Headers / Body 均支持 {"{{ variable }}"}；缺失变量渲染为空字符串。
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="page-save-row">
        <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
          {saving ? "保存中…" : COPY.save}
        </button>
      </div>
    </div>
  );
}
