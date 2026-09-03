import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveScrapeConfig } from "../api";
import { FolderPicker } from "../components/FolderPicker";
import { SettingRow } from "../components/SettingRow";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import { useSharedScrapeConfig } from "../hooks/useSharedScrapeConfig";
import { useCacheDiscard } from "../hooks/settingsDiscard";
import type { SettingsSaveActions } from "../hooks/useDirtyBaseline";
import { SCRAPE_CONFIG_KEY } from "../lib/queryCacheKeys";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

export type DownloadSaveActions = SettingsSaveActions;

type Props = {
  notify: NotifyFn;
  embedded?: boolean;
  value?: ScrapeConfig;
  onChange?: (next: ScrapeConfig) => void;
  onActionsChange?: (actions: DownloadSaveActions | null) => void;
};

const DEFAULT_DOWNLOAD: NonNullable<ScrapeConfig["download"]> = {
  downloadPoster: true,
  downloadThumb: true,
  downloadFanart: false,
  preferHighResPoster: true,
  amazonHdPoster: false,
  tenhowHdPoster: false,
  amazonStrictMode: false,
  skipAmazon: true,
  subtitleLibraryPath: "",
  subtitleAddChsSuffix: false,
  cropRatio: "full",
  cropIndependentPoster: false,
  preferCropResult: true,
};

const POSTER_CROP_ROWS = [
  {
    id: "japan_censored",
    label: "常规有码 JAV",
    hint: "碟封右侧多为海报，建议右侧裁剪",
  },
  {
    id: "japan_gravure",
    label: "写真",
    hint: "建议右侧裁剪",
  },
  {
    id: "japan_uncensored",
    label: "无码作品",
    hint: "可保留原图或人脸识别，推荐不裁剪",
  },
  {
    id: "japan_amateur",
    label: "素人作品",
    hint: "尺寸不规则，建议人脸识别裁剪",
  },
  {
    id: "fc2",
    label: "FC2",
    hint: "尺寸不规则，建议人脸识别裁剪",
  },
  {
    id: "china",
    label: "国产作品",
    hint: "多为完整宽图，建议不裁剪",
  },
  {
    id: "western",
    label: "欧美作品",
    hint: "建议不裁剪",
  },
] as const;

type DownloadSnapshot = {
  download: NonNullable<ScrapeConfig["download"]>;
  coverDownloadStrategy: string;
  posterCrops: Record<string, string>;
};

function withDownloadDefaults(cfg: ScrapeConfig): ScrapeConfig {
  return {
    ...cfg,
    download: { ...DEFAULT_DOWNLOAD, ...cfg.download },
  };
}

function downloadSnapshot(cfg: ScrapeConfig): DownloadSnapshot {
  return {
    download: { ...DEFAULT_DOWNLOAD, ...cfg.download },
    coverDownloadStrategy: cfg.coverDownloadStrategy || "priority",
    posterCrops: Object.fromEntries(
      POSTER_CROP_ROWS.map((row) => [row.id, cfg.kindProfiles[row.id]?.posterCrop || "right"]),
    ),
  };
}

export function DownloadSettingsPanel({
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
    transform: withDownloadDefaults,
    onError: (e) => notify("error", e, "加载下载配置失败"),
  });
  const [baseline, setBaseline] = useState<DownloadSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => {
    if (!config || !baseline || controlled) return false;
    return JSON.stringify(downloadSnapshot(config)) !== JSON.stringify(baseline);
  }, [config, baseline, controlled]);

  dirtyRef.current = dirty;

  useEffect(() => {
    if (!config || controlled) return;
    const next = downloadSnapshot(config);
    if (!dirtyRef.current) {
      setBaseline(next);
    } else {
      setBaseline((prev) => prev ?? next);
    }
  }, [config, controlled]);

  function commit(next: ScrapeConfig) {
    if (controlled) {
      onChange?.(next);
      return;
    }
    setConfig(next);
  }

  function patchDownload(partial: Partial<NonNullable<ScrapeConfig["download"]>>) {
    if (!config) return;
    const next = { ...DEFAULT_DOWNLOAD, ...config.download, ...partial };
    if (typeof partial.amazonHdPoster === "boolean") {
      next.skipAmazon = !partial.amazonHdPoster;
    } else if (typeof partial.skipAmazon === "boolean") {
      next.amazonHdPoster = !partial.skipAmazon;
    }
    commit({
      ...config,
      download: next,
    });
  }

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const dl = { ...DEFAULT_DOWNLOAD, ...config.download };
      const next: ScrapeConfig = {
        ...config,
        download: {
          ...dl,
          subtitleAddChsSuffix: Boolean(
            config.naming?.subtitleAddChsSuffix ?? dl.subtitleAddChsSuffix,
          ),
        },
      };
      const { config: saved } = await saveScrapeConfig(next);
      const normalized = withDownloadDefaults(saved);
      setConfig(normalized);
      setBaseline(downloadSnapshot(normalized));
      notify("ok", "下载配置已保存（下次刮削任务生效）");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }, [config, notify, setConfig]);

  const resetLocal = useCallback(() => {
    dirtyRef.current = false;
    setBaseline(null);
  }, []);
  const discard = useCacheDiscard(SCRAPE_CONFIG_KEY, reload, resetLocal);

  useEffect(() => {
    if (embedded || !onActionsChange) return;
    onActionsChange({ dirty, saving, save, discard });
    return () => onActionsChange(null);
  }, [dirty, saving, save, discard, embedded, onActionsChange]);

  if (loading && !config) {
    return <PanelSkeleton label="加载下载配置…" lines={6} />;
  }

  if (!config) {
    return <PanelSkeleton label="下载配置不可用" lines={4} />;
  }

  const dl = { ...DEFAULT_DOWNLOAD, ...config.download };

  return (
    <div className={`download-settings${refreshing ? " is-refreshing" : ""}`}>
      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">下载内容</h3>
          <div className="mon-panel-lead">从刮削源下载的资源类型；整理时分别写入 poster.jpg / thumb.jpg</div>
        </header>
        <div className="mon-panel-body">
          <SettingRow
            label="海报 / 封面图 / poster"
            hint="整理时写入 poster.jpg（分区裁剪 + 海报水印）"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={dl.downloadPoster}
                onChange={(e) => patchDownload({ downloadPoster: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="缩略图 / thumb"
            hint="建议开启；整理时写入 thumb.jpg（不裁剪，列表用小图）"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={dl.downloadThumb}
                onChange={(e) => patchDownload({ downloadThumb: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="剧照 / extrafanart"
            hint="整理时将 Provider 剧照下载到 extrafanart/ 目录"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={dl.downloadFanart}
                onChange={(e) => patchDownload({ downloadFanart: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">缩略图下载策略</h3>
          <div className="mon-panel-lead">封面/thumb 有多个候选链接时的选图方式</div>
        </header>
        <div className="mon-panel-body">
          <SettingRow label="选图策略">
            <select
              className="org-select"
              value={config.coverDownloadStrategy || "priority"}
              onChange={(e) => commit({ ...config, coverDownloadStrategy: e.target.value })}
            >
              <option value="priority">根据字段优先级</option>
              <option value="size">根据图片质量（较慢）</option>
            </select>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">高清海报</h3>
        </header>
        <div className="mon-panel-body">
          <SettingRow
            label="Amazon 高清海报"
            hint="用标题/番号搜 Amazon JP DVD 高清图；Tenhow 命中 ASIN 时优先精确搜索"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(dl.amazonHdPoster)}
                onChange={(e) => patchDownload({ amazonHdPoster: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="Tenhow 高清海报"
            hint="用演员名在 tenhow.net 检索 ASIN 高清图（约 1055×1500）"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(dl.tenhowHdPoster)}
                onChange={(e) => patchDownload({ tenhowHdPoster: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="严格模式"
            hint="Amazon 因网络/503 失败且无 Tenhow 兜底时中止刮削"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(dl.amazonStrictMode)}
                disabled={!dl.amazonHdPoster}
                onChange={(e) => patchDownload({ amazonStrictMode: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow label="DMM 优先高清" hint="ps.jpg → pl.jpg">
            <label className="switch">
              <input
                type="checkbox"
                checked={dl.preferHighResPoster}
                onChange={(e) => patchDownload({ preferHighResPoster: e.target.checked })}
              />
              <span />
            </label>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">海报裁剪</h3>
        </header>
        <div className="mon-panel-body">
          {POSTER_CROP_ROWS.map((row) => {
            const profile = config.kindProfiles[row.id];
            const cropValue = profile?.posterCrop || "right";
            return (
              <SettingRow key={row.id} label={row.label} hint={row.hint}>
                <select
                  className="org-select"
                  value={cropValue}
                  onChange={(e) => {
                    const posterCrop = e.target.value;
                    const prev = config.kindProfiles[row.id];
                    commit({
                      ...config,
                      kindProfiles: {
                        ...config.kindProfiles,
                        [row.id]: {
                          ...prev,
                          metaSources: prev?.metaSources ?? [],
                          coverSources: prev?.coverSources ?? [],
                          directoryTemplate: prev?.directoryTemplate ?? "{category}/{studio}/{series_name}/{number}",
                          fileNameTemplate: prev?.fileNameTemplate ?? "{number}",
                          nameSuffixTemplate: prev?.nameSuffixTemplate ?? "",
                          posterCrop,
                        },
                      },
                    });
                  }}
                >
                  <option value="right">右侧裁剪</option>
                  <option value="none">不裁剪</option>
                  <option value="face">人脸识别（失败则居中）</option>
                </select>
              </SettingRow>
            );
          })}
          <SettingRow
            label="裁剪比例"
            hint="完整海报 2.12/3；Emby 墙 2/3"
          >
            <select
              className="org-select"
              value={dl.cropRatio || "full"}
              onChange={(e) =>
                patchDownload({
                  cropRatio: e.target.value === "emby" ? "emby" : "full",
                })
              }
            >
              <option value="full">完整海报</option>
              <option value="emby">Emby 比例</option>
            </select>
          </SettingRow>
          <SettingRow
            label="独立海报裁剪"
            hint="对已刮到的海报（含高清）也中心裁保持比例"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(dl.cropIndependentPoster)}
                onChange={(e) =>
                  patchDownload({ cropIndependentPoster: e.target.checked })
                }
              />
              <span />
            </label>
          </SettingRow>
          <SettingRow
            label="优先选择裁剪结果"
            hint="关闭则跳过分区裁剪，保留原图"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={dl.preferCropResult !== false}
                onChange={(e) =>
                  patchDownload({ preferCropResult: e.target.checked })
                }
              />
              <span />
            </label>
          </SettingRow>
        </div>
      </section>

      <section className="mon-panel">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">字幕</h3>
        </header>
        <div className="mon-panel-body">
          <SettingRow
            label="目录设置"
            hint="支持分层目录；按番号匹配后复制到视频旁。.chs 后缀请在「命名」页配置"
            layout="stack"
          >
            <FolderPicker
              value={dl.subtitleLibraryPath || ""}
              onChange={(relative) => patchDownload({ subtitleLibraryPath: relative })}
              onError={(msg) => notify("error", msg, "读取目录失败")}
            />
          </SettingRow>
        </div>
      </section>

      {embedded ? (
        <div className="page-save-row">
          <button
            type="button"
            className="btn primary"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存下载配置"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
