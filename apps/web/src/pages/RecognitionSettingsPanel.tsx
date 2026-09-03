import { useCallback, useMemo, useState } from "react";
import { saveScrapeConfig } from "../api";
import {
  SourcesSubpage,
  SourcesSubpageActions,
  SourcesSubpageLoading,
  SourcesSubpagePanel,
} from "../components/SourcesSubpageLayout";
import {
  useDirtyBaseline,
  useReportSaveActions,
  type SettingsSaveActions,
} from "../hooks/useDirtyBaseline";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import { useSharedScrapeConfig } from "../hooks/useSharedScrapeConfig";
import { SCRAPE_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { RecognitionKindKey, ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
  onActionsChange?: (actions: SettingsSaveActions | null) => void;
};

type RecognitionWords = NonNullable<ScrapeConfig["recognitionWords"]>;

const DEFAULT_RECOGNITION: RecognitionWords = {
  code: {},
  path: {},
};

/** 双列流式排列：左列 有码/写真/素人/FC2，右列 无码/国产/欧美 */
const CATEGORY_ITEMS: Array<{ id: RecognitionKindKey; label: string }> = [
  { id: "japan_censored", label: "有码" },
  { id: "japan_uncensored", label: "无码" },
  { id: "japan_gravure", label: "写真" },
  { id: "china", label: "国产" },
  { id: "japan_amateur", label: "素人" },
  { id: "western", label: "欧美" },
  { id: "fc2", label: "FC2" },
];

function normalizeRecognition(raw?: ScrapeConfig["recognitionWords"]): RecognitionWords {
  return {
    code: { ...DEFAULT_RECOGNITION.code, ...(raw?.code || {}) },
    path: { ...DEFAULT_RECOGNITION.path, ...(raw?.path || {}) },
  };
}

function CategoryWordRow({
  label,
  words,
  onChange,
}: {
  label: string;
  words: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  function add() {
    const parts = draft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const set = new Set(words);
    for (const p of parts) set.add(p);
    onChange([...set]);
    setDraft("");
    setEditing(false);
  }

  function cancel() {
    setDraft("");
    setEditing(false);
  }

  return (
    <div className={`rcogn-compact-row${editing ? " is-editing" : ""}`}>
      <span className="rcogn-compact-label">{label}</span>
      <div className="rcogn-compact-tags">
        {words.map((word) => (
          <button
            key={word}
            type="button"
            className="tag sm rcogn-tag"
            title="点击移除"
            onClick={() => onChange(words.filter((x) => x !== word))}
          >
            {word} ×
          </button>
        ))}
      </div>
      {editing ? (
        <div className="rcogn-compact-add">
          <input
            className="rcogn-compact-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="识别词"
          />
          <button type="button" className="btn sm" onClick={add}>
            确定
          </button>
        </div>
      ) : (
        <button type="button" className="btn sm rcogn-compact-add-btn" onClick={() => setEditing(true)}>
          添加
        </button>
      )}
    </div>
  );
}

function RecognitionBlock({
  title,
  hint,
  note,
  bucket,
  onChange,
}: {
  title: string;
  hint: string;
  note?: string;
  bucket: RecognitionWords["code"];
  onChange: (next: RecognitionWords["code"]) => void;
}) {
  return (
    <div className="rcogn-block">
      <h3 className="rcogn-block-title">{title}</h3>
      <p className="rcogn-block-desc">{hint}</p>
      {note ? <p className="rcogn-block-note">{note}</p> : null}
      <div className="rcogn-compact-grid">
        {CATEGORY_ITEMS.map((item) => (
          <CategoryWordRow
            key={item.id}
            label={item.label}
            words={bucket[item.id] || []}
            onChange={(next) => {
              const merged = { ...bucket };
              if (next.length) merged[item.id] = next;
              else delete merged[item.id];
              onChange(merged);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function RecognitionSettingsPanel({
  notify,
  embedded = false,
  value,
  onChange,
  onActionsChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const { config, loading, refreshing, setConfig, reload } = useSharedScrapeConfig({
    controlled,
    value,
    transform: (cfg) => ({
      ...cfg,
      recognitionWords: normalizeRecognition(cfg.recognitionWords),
    }),
    onError: (e) => notify("error", e, "加载自定义识别配置失败"),
  });
  const [saving, setSaving] = useState(false);

  const snap = useMemo(
    () => (config && !controlled ? normalizeRecognition(config.recognitionWords) : null),
    [config, controlled],
  );
  const { dirty, markClean } = useDirtyBaseline({ current: snap, enabled: !controlled });
  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload);

  function commit(next: ScrapeConfig) {
    setConfig(next);
    if (controlled) onChange?.(next);
  }

  function patchRecognition(next: RecognitionWords) {
    if (!config) return;
    commit({ ...config, recognitionWords: next });
  }

  const save = useCallback(async () => {
    if (!config) return;
    if (controlled) {
      onChange?.(config);
      return;
    }
    setSaving(true);
    try {
      const words = normalizeRecognition(config.recognitionWords);
      const { config: saved } = await saveScrapeConfig({
        ...config,
        recognitionWords: words,
      });
      const normalized = normalizeRecognition(saved.recognitionWords);
      setConfig({
        ...saved,
        recognitionWords: normalized,
      });
      markClean(normalized);
      notify("ok", "自定义识别已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, controlled, markClean, notify, onChange, setConfig]);

  useReportSaveActions(!embedded, dirty, saving, save, onActionsChange, discard);

  if (loading && !config) {
    return <SourcesSubpageLoading label="加载自定义识别配置…" />;
  }
  if (!config) {
    return <SourcesSubpageLoading label="配置不可用" />;
  }

  const recognition = normalizeRecognition(config.recognitionWords);

  return (
    <SourcesSubpage className={refreshing ? "is-refreshing" : undefined}>
      <SourcesSubpagePanel bodyClassName=" rcogn-compact-body">
        <RecognitionBlock
          title="自定义识别词（番号）"
          hint="检测番号前缀，检测到在列表中则覆盖内置的识别规则（忽略大小写）"
          bucket={recognition.code}
          onChange={(code) => patchRecognition({ ...recognition, code })}
        />
        <div className="rcogn-block-divider" role="separator" />
        <RecognitionBlock
          title="自定义识别词（路径）"
          hint="检测完整文件路径（包含文件名），存在对应关键字则覆盖内置的识别规则（忽略大小写）"
          note="注意：番号和路径同时都匹配到识别词时，优先使用番号的识别结果"
          bucket={recognition.path}
          onChange={(path) => patchRecognition({ ...recognition, path })}
        />
      </SourcesSubpagePanel>
      {embedded ? (
        <SourcesSubpageActions>
          <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存配置"}
          </button>
        </SourcesSubpageActions>
      ) : null}
    </SourcesSubpage>
  );
}
