import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { SettingRow } from "./SettingRow";
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

type Props = {
  open: boolean;
  title: string;
  defaultUrl: string;
  value: ProviderSiteConfig | undefined;
  defaultCooldownSec?: number;
  globalRetryDefault: number;
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

export function ProviderSettingsModal({
  open,
  title,
  defaultUrl,
  value,
  defaultCooldownSec = 0,
  globalRetryDefault,
  needsApiKey = false,
  apiKey: apiKeyValue = "",
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ProviderSiteConfig>(EMPTY);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft({
      ...EMPTY,
      ...value,
      baseUrl: value?.baseUrl || defaultUrl || "",
      cooldownSec: value?.cooldownSec ?? defaultCooldownSec,
    });
    setApiKey(apiKeyValue);
  }, [open, value, defaultUrl, defaultCooldownSec, apiKeyValue]);

  function patch(partial: Partial<ProviderSiteConfig>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Modal
      open={open}
      title={title}
      subtitle={needsApiKey ? "API Key 与站点连接" : "站点连接与请求参数"}
      padded
      onClose={onClose}
      footer={
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
                },
                needsApiKey ? { apiKey: apiKey.trim() } : undefined,
              );
              onClose();
            }}
          >
            保存
          </button>
        </>
      }
    >
      <div className="prov-modal">
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
              hint="从 ThePornDB 控制台复制 Token，保存后用于刮削和测通"
              layout="stack"
            >
              <input
                className="org-input"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Bearer Token"
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
            hint="覆盖全局代理；填 null 表示本源不走代理"
            layout="stack"
          >
            <input
              className="org-input"
              value={draft.proxyUrl}
              onChange={(e) => patch({ proxyUrl: e.target.value })}
              placeholder="http://127.0.0.1:7890"
              spellCheck={false}
            />
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
    </Modal>
  );
}
