import { useEffect, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import { SettingRow } from "../components/SettingRow";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
};

type Meta = NonNullable<ScrapeConfig["metadata"]>;
type MappingLang = Meta["mappingLanguage"];

const DEFAULT: Meta = {
  strictMode: false,
  requireCover: false,
  useForumZhTitle: true,
  enableActorMapping: true,
  enableTagMapping: true,
  trimPlot: true,
  mappingLanguage: "zh-CN",
  autoTranslateTitle: false,
  autoTranslateOutline: false,
  translateEngine: "openai",
  customSystemPrompt: "",
};

const LANG_OPTS: { value: MappingLang; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁体中文" },
  { value: "ja", label: "日文" },
  { value: "en", label: "英文" },
];

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

export function MetadataSettingsPanel({
  notify,
  embedded = false,
  value,
  onChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const [config, setConfig] = useState<ScrapeConfig | null>(
    value ? { ...value, metadata: { ...DEFAULT, ...value.metadata } } : null,
  );
  const [loading, setLoading] = useState(!controlled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!controlled) return;
    setConfig(value ? { ...value, metadata: { ...DEFAULT, ...value.metadata } } : null);
    setLoading(false);
  }, [controlled, value]);

  useEffect(() => {
    if (controlled) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        setConfig({
          ...data.config,
          metadata: { ...DEFAULT, ...data.config.metadata },
        });
      } catch (e) {
        notify("error", e, "加载元数据配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [controlled, notify]);

  function commit(next: ScrapeConfig) {
    setConfig(next);
    if (controlled) onChange?.(next);
  }

  function patch(partial: Partial<Meta>) {
    if (!config) return;
    commit({
      ...config,
      metadata: { ...DEFAULT, ...config.metadata, ...partial },
    });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await saveScrapeConfig(config);
      setConfig({ ...saved, metadata: { ...DEFAULT, ...saved.metadata } });
      notify("ok", "元数据配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载元数据配置…</div>;
  }

  const m = { ...DEFAULT, ...config.metadata };

  return (
    <div className="metadata-settings">
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">元数据</h3>
        </header>
        <div className="mon-panel-body">
          <Section title="数据校验" hint="刮削后对元数据进行校验">
            <SettingRow
              label="启用严格字段模式"
              hint="关键字段缺失时触发完整性校验，防止漏刮数据"
            >
              <Switch checked={m.strictMode} onChange={(v) => patch({ strictMode: v })} />
            </SettingRow>
            <SettingRow
              label="强制校验图片结果"
              hint="封面或缩略图未成功刮削时视为失败"
            >
              <Switch checked={m.requireCover} onChange={(v) => patch({ requireCover: v })} />
            </SettingRow>
          </Section>

          <Section title="元数据优化" hint="刮削后对元数据进行优化处理">
            <SettingRow
              label="使用色花堂中文标题"
              hint="番号匹配时优先使用色花堂中文标题"
            >
              <Switch
                checked={m.useForumZhTitle}
                onChange={(v) => patch({ useForumZhTitle: v })}
              />
            </SettingRow>
            <SettingRow
              label="启用演员数据映射"
              hint="用内置表规范化演员名，并补充 javdb 页面链接"
            >
              <Switch
                checked={m.enableActorMapping}
                onChange={(v) => patch({ enableActorMapping: v })}
              />
            </SettingRow>
            <SettingRow label="启用标签数据映射" hint="用内置表规范化标签描述">
              <Switch
                checked={m.enableTagMapping}
                onChange={(v) => patch({ enableTagMapping: v })}
              />
            </SettingRow>
            <SettingRow
              label="精简多余的换行符（简介）"
              hint="多个连续换行压缩为单个"
            >
              <Switch checked={m.trimPlot} onChange={(v) => patch({ trimPlot: v })} />
            </SettingRow>
            <SettingRow
              label="数据映射语言"
              hint="演员名、标签等静态映射所用语言"
            >
              <select
                className="org-select"
                value={m.mappingLanguage}
                onChange={(e) => patch({ mappingLanguage: e.target.value as MappingLang })}
              >
                {LANG_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingRow>
          </Section>

          <Section title="自动翻译" hint="刮削后调用翻译引擎自动翻译指定字段">
            <SettingRow label="翻译标题" hint="刮削后自动翻译标题">
              <Switch
                checked={m.autoTranslateTitle}
                onChange={(v) => patch({ autoTranslateTitle: v })}
              />
            </SettingRow>
            <SettingRow label="翻译简介" hint="刮削后自动翻译简介">
              <Switch
                checked={m.autoTranslateOutline}
                onChange={(v) => patch({ autoTranslateOutline: v })}
              />
            </SettingRow>
          </Section>

          <Section
            title="翻译引擎"
            hint="请在系统设置页配置 OpenAI 兼容接口参数"
          >
            <SettingRow label="引擎">
              <select
                className="org-select"
                value={m.translateEngine}
                onChange={() => patch({ translateEngine: "openai" })}
              >
                <option value="openai">OpenAI 兼容</option>
              </select>
            </SettingRow>
            <SettingRow label="自定义 System Prompt（可选）" layout="stack">
              <textarea
                className="org-textarea"
                rows={4}
                placeholder="留空使用内置提示词"
                value={m.customSystemPrompt}
                onChange={(e) => patch({ customSystemPrompt: e.target.value })}
              />
            </SettingRow>
          </Section>
        </div>
      </section>
      {!embedded ? (
        <div className="page-save-row">
          <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : COPY.save}
          </button>
        </div>
      ) : null}
    </div>
  );
}
