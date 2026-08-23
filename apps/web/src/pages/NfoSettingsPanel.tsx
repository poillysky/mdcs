import { useEffect, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import { SettingRow } from "../components/SettingRow";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = { notify: NotifyFn };
type Nfo = NonNullable<ScrapeConfig["nfo"]>;
type IncludeKey = keyof Nfo["include"];
type TagExtraKey = keyof Nfo["tagExtras"];

const DEFAULT_INCLUDE: Nfo["include"] = {
  sorttitle: true,
  originaltitle: true,
  titleCd: false,
  outline: true,
  plot: true,
  originalplot: true,
  outlineNoCdata: false,
  outlineShowFrom: false,
  release: true,
  releasedate: true,
  premiered: true,
  actor: true,
  director: true,
  country: true,
  mpaa: true,
  customrating: true,
  year: true,
  runtime: true,
  votes: true,
  score: true,
  criticrating: true,
  series: true,
  tag: true,
  genre: true,
  studio: true,
  maker: true,
  publisher: true,
  label: true,
  poster: true,
  cover: true,
  trailer: true,
  website: true,
  actorSet: false,
  seriesSet: true,
  prefixSet: false,
};

const DEFAULT_TAG_EXTRAS: Nfo["tagExtras"] = {
  letters: true,
  actor: true,
  definition: true,
  cnword: true,
  mosaic: true,
  series: true,
  studio: true,
  publisher: true,
};

const DEFAULT: Nfo = {
  enabled: true,
  mergeStrategy: "prefer_scraped",
  include: DEFAULT_INCLUDE,
  tagExtras: DEFAULT_TAG_EXTRAS,
  tagline: "发行日期: {release}",
  tagFormats: {
    cnword: "中文字幕",
    series: "系列: {series}",
    studio: "片商: {studio}",
    publisher: "发行: {publisher}",
  },
};

function mergeNfo(partial?: Partial<Nfo> | null): Nfo {
  return {
    ...DEFAULT,
    ...partial,
    include: { ...DEFAULT_INCLUDE, ...partial?.include },
    tagExtras: { ...DEFAULT_TAG_EXTRAS, ...partial?.tagExtras },
    tagFormats: { ...DEFAULT.tagFormats, ...partial?.tagFormats },
  };
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

function CheckGrid({
  items,
  values,
  onToggle,
}: {
  items: { key: string; label: string }[];
  values: Record<string, boolean>;
  onToggle: (key: string, v: boolean) => void;
}) {
  return (
    <div className="nfo-check-grid">
      {items.map((it) => (
        <label key={it.key} className="nfo-check">
          <input
            type="checkbox"
            checked={Boolean(values[it.key])}
            onChange={(e) => onToggle(it.key, e.target.checked)}
          />
          <span className="nfo-check-mark" aria-hidden />
          <span className="nfo-check-text">{it.label}</span>
        </label>
      ))}
    </div>
  );
}

export function NfoSettingsPanel({ notify }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        const nfo = mergeNfo(data.config.nfo);
        if (!data.config.nfo && data.config.nfoMergeStrategy) {
          nfo.mergeStrategy = data.config.nfoMergeStrategy;
        }
        setConfig({ ...data.config, nfo });
      } catch (e) {
        notify("error", e, "加载 NFO 配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  function patchNfo(partial: Partial<Nfo>) {
    if (!config) return;
    const nfo = mergeNfo({ ...config.nfo, ...partial });
    setConfig({
      ...config,
      nfo,
      nfoMergeStrategy: nfo.mergeStrategy,
    });
  }

  function patchInclude(key: IncludeKey, v: boolean) {
    if (!config?.nfo) return;
    patchNfo({ include: { ...config.nfo.include, [key]: v } });
  }

  function patchTagExtra(key: TagExtraKey, v: boolean) {
    if (!config?.nfo) return;
    patchNfo({ tagExtras: { ...config.nfo.tagExtras, [key]: v } });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        ...config,
        nfo: mergeNfo(config.nfo),
        nfoMergeStrategy: mergeNfo(config.nfo).mergeStrategy,
      };
      const { config: saved } = await saveScrapeConfig(payload);
      setConfig({ ...saved, nfo: mergeNfo(saved.nfo) });
      notify("ok", "NFO 配置已保存");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return <div className="empty-block">加载 NFO 配置…</div>;
  }

  const nfo = mergeNfo(config.nfo);
  const inc = nfo.include;
  const te = nfo.tagExtras;

  return (
    <div className="nfo-settings">
      <section className="mon-panel settings-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">NFO</h3>
        </header>
        <div className="mon-panel-body">
          <Section title="启用 NFO" hint="根据刮削数据生成 .nfo 文件">
            <SettingRow label="启用 NFO">
              <Switch checked={nfo.enabled} onChange={(v) => patchNfo({ enabled: v })} />
            </SettingRow>
            <SettingRow label="合并策略" hint="重刮/重整理时的字段优先级">
              <select
                className="org-select"
                value={nfo.mergeStrategy}
                onChange={(e) =>
                  patchNfo({
                    mergeStrategy: e.target.value as Nfo["mergeStrategy"],
                  })
                }
              >
                <option value="prefer_scraped">刮削结果覆盖</option>
                <option value="prefer_nfo">本地非空优先</option>
              </select>
            </SettingRow>
          </Section>

          <Section title="标题">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "sorttitle", label: "类标题 (sorttitle)" },
                { key: "originaltitle", label: "原标题 (originaltitle)" },
                { key: "titleCd", label: "标题后添加分集信息" },
              ]}
            />
          </Section>

          <Section title="简介">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "outline", label: "简介 (outline)" },
                { key: "plot", label: "简介 (plot)" },
                { key: "originalplot", label: "原简介 (originalplot)" },
                { key: "outlineNoCdata", label: "简介不使用 CDATA（纯文本转义）" },
                { key: "outlineShowFrom", label: "简介后添加翻译来源信息" },
              ]}
            />
          </Section>

          <Section title="演员 / 导演">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "actor", label: "演员 (actor)" },
                { key: "director", label: "导演 (director)" },
              ]}
            />
          </Section>

          <Section title="发行日期">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "release", label: "发行日期 (release)" },
                { key: "releasedate", label: "发行日期 (releasedate)" },
                { key: "premiered", label: "发行日期 (premiered)" },
              ]}
            />
            <SettingRow label="Tagline 格式" hint="常用 {release}">
              <input
                className="org-input"
                value={nfo.tagline}
                onChange={(e) => patchNfo({ tagline: e.target.value })}
              />
            </SettingRow>
          </Section>

          <Section title="国家 / 分级">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "country", label: "国家 (country)" },
                { key: "mpaa", label: "分级 (mpaa)" },
                { key: "customrating", label: "自定义分级 (customrating)" },
              ]}
            />
          </Section>

          <Section title="年份 / 时长 / 想看人数">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "year", label: "年份 (year)" },
                { key: "runtime", label: "时长 (runtime)" },
                { key: "votes", label: "想看人数 (votes)" },
              ]}
            />
          </Section>

          <Section title="评分">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "score", label: "公众评分 (score)" },
                { key: "criticrating", label: "影评人评分 (criticrating)" },
              ]}
            />
          </Section>

          <Section title="系列 / 标签 / 风格">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "series", label: "系列 (series)" },
                { key: "tag", label: "标签 (tag)" },
                { key: "genre", label: "风格 (genre，使用标签数据)" },
              ]}
            />
          </Section>

          <Section title="附加标签内容" hint="写入 tag/genre 的衍生字段">
            <CheckGrid
              values={te as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchTagExtra(k as TagExtraKey, v)}
              items={[
                { key: "letters", label: "番号前缀" },
                { key: "actor", label: "演员" },
                { key: "definition", label: "分辨率" },
                { key: "cnword", label: "中文字幕" },
                { key: "mosaic", label: "有码 / 无码" },
                { key: "series", label: "系列" },
                { key: "studio", label: "片商" },
                { key: "publisher", label: "发行商" },
              ]}
            />
          </Section>

          <Section title="标签格式">
            {(
              [
                ["cnword", "中文字幕"],
                ["series", "系列"],
                ["studio", "片商"],
                ["publisher", "发行商"],
              ] as const
            ).map(([key, label]) => (
              <SettingRow key={key} label={label}>
                <input
                  className="org-input"
                  value={nfo.tagFormats[key]}
                  onChange={(e) =>
                    patchNfo({
                      tagFormats: { ...nfo.tagFormats, [key]: e.target.value },
                    })
                  }
                />
              </SettingRow>
            ))}
          </Section>

          <Section title="片商 / 发行商">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "studio", label: "片商 (studio)" },
                { key: "maker", label: "片商 (maker)" },
                { key: "publisher", label: "发行商 (publisher)" },
                { key: "label", label: "发行商 (label)" },
              ]}
            />
          </Section>

          <Section title="海报 / 封面 / 网址">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "poster", label: "海报 (poster)" },
                { key: "cover", label: "封面等 (cover)" },
                { key: "trailer", label: "预告片 (trailer)" },
                { key: "website", label: "网址 (website)" },
              ]}
            />
          </Section>

          <Section title="合集" hint="根据对应元数据信息创建合集">
            <CheckGrid
              values={inc as unknown as Record<string, boolean>}
              onToggle={(k, v) => patchInclude(k as IncludeKey, v)}
              items={[
                { key: "actorSet", label: "使用演员字段" },
                { key: "seriesSet", label: "使用系列字段" },
                { key: "prefixSet", label: "使用番号前缀" },
              ]}
            />
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
