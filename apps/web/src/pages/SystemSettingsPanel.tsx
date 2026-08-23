import { useEffect, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import { SettingRow } from "../components/SettingRow";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = { notify: NotifyFn };

const DEFAULT_LLM = {
  baseUrl: "",
  apiKey: "",
  model: "gpt-4o",
};

const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";

function syncLlmLocal(llm: { baseUrl: string; apiKey: string; model: string }) {
  localStorage.setItem("scrap.llm.baseUrl", llm.baseUrl || "");
  localStorage.setItem("scrap.llm.apiKey", llm.apiKey || "");
  localStorage.setItem("scrap.llm.model", llm.model || DEFAULT_LLM.model);
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="set-section">
      <div className="set-section-head">
        <div className="set-section-title">{title}</div>
        {hint ? <p className="set-section-sub">{hint}</p> : null}
      </div>
      <div className="set-section-body">{children}</div>
    </div>
  );
}

export function SystemSettingsPanel({ notify }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        const cfg = data.config;
        const llm = {
          baseUrl: cfg.llm?.baseUrl || localStorage.getItem("scrap.llm.baseUrl") || "",
          apiKey: cfg.llm?.apiKey || localStorage.getItem("scrap.llm.apiKey") || "",
          model:
            cfg.llm?.model ||
            localStorage.getItem("scrap.llm.model") ||
            DEFAULT_LLM.model,
        };
        setConfig({ ...cfg, llm });
        syncLlmLocal(llm);
      } catch (e) {
        notify("error", e, "加载系统配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  function patch(next: Partial<ScrapeConfig>) {
    if (!config) return;
    setConfig({ ...config, ...next });
  }

  function patchLlm(partial: Partial<NonNullable<ScrapeConfig["llm"]>>) {
    if (!config) return;
    const llm = { ...DEFAULT_LLM, ...config.llm, ...partial };
    setConfig({ ...config, llm });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const llm = {
        baseUrl: config.llm?.baseUrl || "",
        apiKey: config.llm?.apiKey || "",
        model: config.llm?.model || DEFAULT_LLM.model,
      };
      const { config: saved } = await saveScrapeConfig({ ...config, llm });
      setConfig(saved);
      syncLlmLocal(saved.llm || llm);
      notify("ok", "系统配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function testLlm() {
    const rawBase = (config?.llm?.baseUrl || "").trim();
    const base = (rawBase || OPENAI_DEFAULT_BASE).replace(/\/$/, "");
    const apiKey = config?.llm?.apiKey || "";
    const model = config?.llm?.model || DEFAULT_LLM.model;
    syncLlmLocal({ baseUrl: rawBase, apiKey, model });
    setLlmTesting(true);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text ? `HTTP ${res.status}: ${text.slice(0, 160)}` : `HTTP ${res.status}`);
      }
      notify("ok", `已连通（${model} · ${base}）`);
    } catch (e) {
      notify("error", e, "测试连接失败");
    } finally {
      setLlmTesting(false);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载系统配置…</div>;
  }

  const llm = { ...DEFAULT_LLM, ...config.llm };

  return (
    <div className="system-settings">
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">系统</h3>
        </header>
        <div className="mon-panel-body">
          <Section
            title="刮削并发"
            hint="同时进行的刮削工作线程；按部署环境调整，下次任务生效"
          >
            <SettingRow
              label="快速并发"
              hint="不过盾站点的并行数（通常可设高一些）"
            >
              <input
                className="org-input-sm"
                type="number"
                min={1}
                max={16}
                value={config.exportFastConcurrency}
                onChange={(e) =>
                  patch({ exportFastConcurrency: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </SettingRow>
            <SettingRow
              label="慢速并发"
              hint="经 FlareSolverr 过盾的并行数（建议偏低，避免封禁）"
            >
              <input
                className="org-input-sm"
                type="number"
                min={1}
                max={8}
                value={config.exportSlowConcurrency}
                onChange={(e) =>
                  patch({ exportSlowConcurrency: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </SettingRow>
          </Section>

          <Section
            title="OpenAI 相关配置"
            hint="兼容 OpenAI API 的接口（官方 / DeepSeek / 本地中转等）；供元数据翻译与命名助手使用"
          >
            <SettingRow label="API Key" hint="API 密钥，sk-xxx" layout="stack">
              <div className="actors-key-row">
                <input
                  className="org-input"
                  type={showKey ? "text" : "password"}
                  value={llm.apiKey}
                  onChange={(e) => patchLlm({ apiKey: e.target.value })}
                  placeholder="API Key"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn actors-key-toggle"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "隐藏" : "显示"}
                </button>
              </div>
            </SettingRow>
            <SettingRow
              label="Base URL"
              hint="兼容 OpenAI 规范的接口，如 https://api.deepseek.com"
              layout="stack"
            >
              <input
                className="org-input"
                value={llm.baseUrl}
                onChange={(e) => patchLlm({ baseUrl: e.target.value })}
                placeholder="默认使用 OpenAI 官方接口"
                spellCheck={false}
                autoComplete="off"
              />
            </SettingRow>
            <SettingRow
              label="Model"
              hint="模型名称，如 gpt-4o、deepseek-chat；暂不支持推理模型"
            >
              <input
                className="org-input"
                value={llm.model}
                onChange={(e) => patchLlm({ model: e.target.value })}
                placeholder="gpt-4o"
                spellCheck={false}
              />
            </SettingRow>
            <div className="sys-llm-actions">
              <button
                type="button"
                className="btn"
                disabled={llmTesting}
                onClick={() => void testLlm()}
              >
                {llmTesting ? "测试中…" : "测试连接"}
              </button>
            </div>
          </Section>
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
