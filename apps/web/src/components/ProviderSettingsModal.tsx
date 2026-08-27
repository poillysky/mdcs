import { useEffect, useState } from "react";
import {
  InformationCircleIcon,
  LightBulbIcon,
  PhotoIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { SettingRow } from "./SettingRow";
import { getProviderGuide } from "./providerGuide";
import type { ProviderSiteConfig } from "../types";

const EMPTY: ProviderSiteConfig = {
  baseUrl: "",
  cookie: "",
  userAgent: "",
  cooldownSec: 0,
  overrideRetry: false,
  retry: 0,
  proxyUrl: "",
};

type TabId = "params" | "about";

type Props = {
  open: boolean;
  title: string;
  sourceId: string;
  group?: string;
  access?: string;
  implemented?: boolean;
  notes?: string;
  defaultUrl: string;
  value: ProviderSiteConfig | undefined;
  defaultCooldownSec?: number;
  globalRetryDefault: number;
  /** 网络设置里的全局代理，用于「复用全局」时展示 */
  globalProxyUrl?: string;
  needsApiKey?: boolean;
  apiKey?: string;
  onClose: () => void;
  onSave: (next: ProviderSiteConfig, extras?: { apiKey?: string }) => void;
};

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

function parseStoredProxy(raw: string | undefined): { useGlobal: boolean; custom: string } {
  const t = String(raw || "").trim();
  if (!t) return { useGlobal: true, custom: "" };
  if (t.toLowerCase() === "null") return { useGlobal: false, custom: "" };
  return { useGlobal: false, custom: t };
}

function persistProxy(useGlobal: boolean, custom: string): string {
  if (useGlobal) return "";
  const t = custom.trim();
  return t && t.toLowerCase() !== "null" ? t : "null";
}

const ACCESS_HINT: Record<string, string> = {
  proxy: "自适应（代理直连，遇盾回落 Flare）",
  proxy_adaptive: "自适应（curl → Node → Flare）",
  proxy_flare: "强制过盾（FlareSolverr）",
  direct: "自适应（代理直连，遇盾回落 Flare）",
};

const ACCESS_BADGE: Record<string, string> = {
  proxy: "adaptive",
  proxy_adaptive: "adaptive",
  proxy_flare: "flare",
  direct: "adaptive",
};

function splitGuideFields(text: string): { items: string[]; note?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { items: [] };
  const dot = trimmed.search(/[。；]/);
  const main = dot >= 0 ? trimmed.slice(0, dot) : trimmed;
  const note = dot >= 0 ? trimmed.slice(dot + 1).replace(/^[。；\s]+/, "").trim() : undefined;
  const items = main
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { items, note: note || undefined };
}

export function ProviderSettingsModal({
  open,
  title,
  sourceId,
  group,
  access,
  implemented = true,
  notes,
  defaultUrl,
  value,
  defaultCooldownSec = 0,
  globalRetryDefault,
  globalProxyUrl = "",
  needsApiKey = false,
  apiKey: apiKeyValue = "",
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ProviderSiteConfig>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [tab, setTab] = useState<TabId>("params");
  const [useGlobalProxy, setUseGlobalProxy] = useState(true);
  const [customProxy, setCustomProxy] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("params");
    const parsed = parseStoredProxy(value?.proxyUrl);
    setUseGlobalProxy(parsed.useGlobal);
    setCustomProxy(parsed.custom);
    setDraft({
      ...EMPTY,
      ...value,
      baseUrl: value?.baseUrl || defaultUrl || "",
      cooldownSec: value?.cooldownSec ?? defaultCooldownSec,
      proxyUrl: persistProxy(parsed.useGlobal, parsed.custom),
    });
    setApiKey(apiKeyValue);
  }, [open, value, defaultUrl, defaultCooldownSec, apiKeyValue]);

  function patch(partial: Partial<ProviderSiteConfig>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  const guide = getProviderGuide(sourceId, group, notes);
  const fieldParts = splitGuideFields(guide.fields);
  const accessKey = ACCESS_BADGE[access || ""] || "default";

  return (
    <Modal
      open={open}
      title={title}
      subtitle={tab === "params" ? (needsApiKey ? "API Key 与站点连接" : "站点连接与请求参数") : "站点说明与使用建议"}
      padded
      onClose={onClose}
      footer={
        tab === "params" ? (
          <>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onSave(
                  {
                    ...draft,
                    baseUrl: draft.baseUrl.trim() === defaultUrl.trim() ? "" : draft.baseUrl.trim(),
                    proxyUrl: persistProxy(useGlobalProxy, customProxy),
                  },
                  needsApiKey ? { apiKey: apiKey.trim() } : undefined,
                );
                onClose();
              }}
            >
              保存
            </button>
          </>
        ) : (
          <button type="button" className="btn primary" onClick={onClose}>
            关闭
          </button>
        )
      }
    >
      <div className="prov-modal">
        <div className="prov-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "params"}
            className={`prov-modal-tab${tab === "params" ? " is-active" : ""}`}
            onClick={() => setTab("params")}
          >
            参数
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "about"}
            className={`prov-modal-tab${tab === "about" ? " is-active" : ""}`}
            onClick={() => setTab("about")}
          >
            说明
          </button>
        </div>

        <div className="prov-modal-panels">
          <div
            className={`prov-modal-panel${tab === "params" ? "" : " is-hidden"}`}
            role="tabpanel"
            aria-hidden={tab !== "params"}
          >
            <div className="org-stack">
              <SettingRow label="网站地址" hint={`默认 ${defaultUrl || "—"}`} layout="stack">
                <input
                  className="org-input"
                  value={draft.baseUrl}
                  onChange={(e) => patch({ baseUrl: e.target.value })}
                  spellCheck={false}
                />
              </SettingRow>
              <SettingRow label="Cookie" hint="年龄门 / 访问不稳定时填写" layout="stack">
                <input
                  className="org-input"
                  value={draft.cookie}
                  onChange={(e) => patch({ cookie: e.target.value })}
                  placeholder="例如 existmag=all; age=verified"
                  spellCheck={false}
                />
              </SettingRow>
              {needsApiKey ? (
                <SettingRow
                  label="API Key"
                  hint={
                    apiKey.trim()
                      ? "从 ThePornDB 控制台复制 Token，保存后用于刮削和测通"
                      : "未填写：欧美源刮削会报「需要 ThePornDB API Key」；请到控制台复制 Token"
                  }
                  layout="stack"
                >
                  <input
                    className="org-input"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Bearer Token（必填）"
                    spellCheck={false}
                  />
                </SettingRow>
              ) : null}
              <SettingRow label="User-Agent" hint="过盾或被拦时覆盖浏览器标识" layout="stack">
                <input
                  className="org-input"
                  value={draft.userAgent}
                  onChange={(e) => patch({ userAgent: e.target.value })}
                  placeholder="留空则使用全局 UA"
                  spellCheck={false}
                />
              </SettingRow>
              <SettingRow
                label="代理地址"
                hint={
                  useGlobalProxy
                    ? `开关打开：跟随网络设置里的全局代理${globalProxyUrl.trim() ? `（${globalProxyUrl.trim()}）` : "（尚未填写）"}`
                    : "开关关闭：填写本源专用代理；留空则直连"
                }
                layout="stack"
              >
                <div className={`prov-proxy-ctrl${useGlobalProxy ? " is-global" : ""}`}>
                  <Switch
                    checked={useGlobalProxy}
                    onChange={(v) => {
                      setUseGlobalProxy(v);
                      patch({ proxyUrl: persistProxy(v, customProxy) });
                    }}
                  />
                  <input
                    className="org-input"
                    value={useGlobalProxy ? globalProxyUrl : customProxy}
                    disabled={useGlobalProxy}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCustomProxy(next);
                      patch({ proxyUrl: persistProxy(false, next) });
                    }}
                    placeholder={useGlobalProxy ? "跟随全局代理" : "留空则直连"}
                    spellCheck={false}
                  />
                </div>
              </SettingRow>
            </div>
            <div className="org-stack">
              <SettingRow label="冷却时间" hint="两次请求最短间隔（秒）">
                <input
                  className="org-input-sm"
                  type="number"
                  min={0}
                  value={draft.cooldownSec}
                  onChange={(e) => patch({ cooldownSec: Math.max(0, Number(e.target.value) || 0) })}
                />
              </SettingRow>
              <SettingRow
                label="覆盖全局重试"
                hint={`关闭时使用全局默认 ${globalRetryDefault} 次`}
              >
                <Switch checked={draft.overrideRetry} onChange={(v) => patch({ overrideRetry: v })} />
              </SettingRow>
              <SettingRow
                label="失败重试次数"
                hint={draft.overrideRetry ? "仅对本源生效" : "当前跟随全局默认"}
              >
                <input
                  className="org-input-sm"
                  type="number"
                  min={0}
                  disabled={!draft.overrideRetry}
                  value={draft.overrideRetry ? draft.retry : globalRetryDefault}
                  onChange={(e) => patch({ retry: Math.max(0, Number(e.target.value) || 0) })}
                />
              </SettingRow>
            </div>
          </div>

          <div
            className={`prov-modal-panel is-about${tab === "about" ? "" : " is-hidden"}`}
            role="tabpanel"
            aria-hidden={tab !== "about"}
          >
            <div className="prov-about">
              <header className="prov-about-head">
                <div className="prov-about-badges">
                  <span className="prov-badge prov-badge-id">{sourceId}</span>
                  <span className={`prov-badge prov-badge-access prov-badge-access--${accessKey}`}>
                    {ACCESS_HINT[access || ""] || access || "—"}
                  </span>
                  <span className={`prov-badge ${implemented ? "prov-badge-ok" : "prov-badge-stub"}`}>
                    <span className="prov-badge-dot" aria-hidden />
                    {implemented ? "已实现" : "未实现（stub）"}
                  </span>
                </div>
              </header>

              <div className="prov-about-cards">
                <section className="prov-about-card">
                  <div className="prov-about-card-icon" aria-hidden>
                    <InformationCircleIcon />
                  </div>
                  <div className="prov-about-card-body">
                    <h4>基本情况</h4>
                    <p>{guide.summary}</p>
                  </div>
                </section>

                <section className="prov-about-card">
                  <div className="prov-about-card-icon prov-about-card-icon--cover" aria-hidden>
                    <PhotoIcon />
                  </div>
                  <div className="prov-about-card-body">
                    <h4>封面</h4>
                    <p>{guide.cover}</p>
                  </div>
                </section>
              </div>

              <section className="prov-about-card prov-about-card--wide">
                <div className="prov-about-card-icon prov-about-card-icon--fields" aria-hidden>
                  <TagIcon />
                </div>
                <div className="prov-about-card-body">
                  <h4>元数据字段</h4>
                  {fieldParts.items.length ? (
                    <div className="prov-field-chips">
                      {fieldParts.items.map((item) => (
                        <span key={item} className="prov-field-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>{guide.fields}</p>
                  )}
                  {fieldParts.note ? <p className="prov-about-note">{fieldParts.note}</p> : null}
                </div>
              </section>

              <section className="prov-about-callout">
                <div className="prov-about-callout-icon" aria-hidden>
                  <LightBulbIcon />
                </div>
                <div className="prov-about-callout-body">
                  <h4>建议用法</h4>
                  <p>{guide.usage}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
