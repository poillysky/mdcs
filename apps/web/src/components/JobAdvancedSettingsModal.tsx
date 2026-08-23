import { useState } from "react";
import { Modal } from "./Modal";
import {
  JOB_ADVANCED_TABS,
  defaultJobOptions,
  isUsingGlobal,
  type JobOptions,
  type JobOptionsTab,
} from "../lib/jobOptions";
import { COPY } from "../lib/messages";

type Props = {
  open: boolean;
  value: JobOptions;
  onChange: (next: JobOptions) => void;
  onClose: () => void;
};

export function JobAdvancedSettingsModal({ open, value, onChange, onClose }: Props) {
  const [tab, setTab] = useState<JobOptionsTab>("organize");
  const options = { ...defaultJobOptions(), ...value };

  function patch(partial: Partial<JobOptions>) {
    onChange({ ...options, ...partial });
  }

  function patchTabGlobal(nextTab: JobOptionsTab, useGlobal: boolean) {
    patch({
      useGlobal: { ...options.useGlobal, [nextTab]: useGlobal },
    });
  }

  function renderFields() {
    const useGlobal = isUsingGlobal(options, tab);
    if (useGlobal) {
      return (
        <p className="hint">
          当前使用全局配置。关闭上方开关后可为此任务单独覆盖字段（仅本次任务生效，不写入全局）。
        </p>
      );
    }

    switch (tab) {
      case "organize":
        return (
          <div className="form-grid">
            <label className="field">
              <span>整理模式</span>
              <select
                value={options.organize?.organizeMode ?? "hardlink"}
                onChange={(e) =>
                  patch({ organize: { ...options.organize, organizeMode: e.target.value } })
                }
              >
                <option value="hardlink">硬链接</option>
                <option value="softlink">软链接</option>
                <option value="inplace">原地整理</option>
                <option value="copy">复制</option>
                <option value="move">移动</option>
              </select>
            </label>
            <label className="field">
              <span>输出目录（相对路径）</span>
              <input
                value={options.organize?.libraryRoot ?? ""}
                onChange={(e) =>
                  patch({ organize: { ...options.organize, libraryRoot: e.target.value } })
                }
                placeholder="留空=按分区 libraryRoot"
              />
            </label>
            <label className="field">
              <span>冲突策略</span>
              <select
                value={options.organize?.onConflict ?? "skip"}
                onChange={(e) =>
                  patch({ organize: { ...options.organize, onConflict: e.target.value } })
                }
              >
                <option value="skip">跳过</option>
                <option value="overwrite">覆盖</option>
                <option value="rename">重命名</option>
              </select>
            </label>
          </div>
        );
      case "download":
        return (
          <div className="form-grid">
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.download?.downloadPoster ?? true}
                onChange={(e) =>
                  patch({
                    download: { ...options.download, downloadPoster: e.target.checked },
                  })
                }
              />
              <span>下载海报</span>
            </label>
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.download?.downloadThumb ?? true}
                onChange={(e) =>
                  patch({
                    download: { ...options.download, downloadThumb: e.target.checked },
                  })
                }
              />
              <span>下载缩略图</span>
            </label>
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.download?.skipAmazon ?? false}
                onChange={(e) =>
                  patch({
                    download: { ...options.download, skipAmazon: e.target.checked },
                  })
                }
              />
              <span>跳过 Amazon 封面</span>
            </label>
          </div>
        );
      case "naming":
        return (
          <div className="form-grid">
            <label className="field span-2">
              <span>目录命名模板</span>
              <input
                value={options.naming?.directoryTemplate ?? ""}
                onChange={(e) =>
                  patch({ naming: { ...options.naming, directoryTemplate: e.target.value } })
                }
                placeholder="{category}/{studio}/{number}"
              />
            </label>
            <label className="field span-2">
              <span>视频文件命名模板</span>
              <input
                value={options.naming?.fileNameTemplate ?? ""}
                onChange={(e) =>
                  patch({ naming: { ...options.naming, fileNameTemplate: e.target.value } })
                }
                placeholder="{number}"
              />
            </label>
          </div>
        );
      case "watermark":
        return (
          <div className="form-grid">
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.watermark?.enabled ?? false}
                onChange={(e) =>
                  patch({ watermark: { ...options.watermark, enabled: e.target.checked } })
                }
              />
              <span>启用水印</span>
            </label>
            <label className="field">
              <span>固定位置</span>
              <select
                value={options.watermark?.position ?? "bottom-right"}
                onChange={(e) =>
                  patch({ watermark: { ...options.watermark, position: e.target.value } })
                }
              >
                <option value="bottom-right">右下</option>
                <option value="bottom-left">左下</option>
                <option value="top-right">右上</option>
                <option value="top-left">左上</option>
              </select>
            </label>
          </div>
        );
      case "metadata":
        return (
          <div className="form-grid">
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.metadata?.strictMode ?? false}
                onChange={(e) =>
                  patch({ metadata: { ...options.metadata, strictMode: e.target.checked } })
                }
              />
              <span>严格模式</span>
            </label>
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.metadata?.autoTranslate ?? false}
                onChange={(e) =>
                  patch({ metadata: { ...options.metadata, autoTranslate: e.target.checked } })
                }
              />
              <span>自动翻译标题</span>
            </label>
          </div>
        );
      case "nfo":
        return (
          <div className="form-grid">
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.nfo?.writeActors ?? true}
                onChange={(e) =>
                  patch({ nfo: { ...options.nfo, writeActors: e.target.checked } })
                }
              />
              <span>写入演员</span>
            </label>
            <label className="switch block">
              <input
                type="checkbox"
                checked={options.nfo?.writeGenres ?? true}
                onChange={(e) =>
                  patch({ nfo: { ...options.nfo, writeGenres: e.target.checked } })
                }
              />
              <span>写入类型标签</span>
            </label>
          </div>
        );
      case "sources":
        return (
          <label className="field">
            <span>元数据源（逗号分隔，按顺序）</span>
            <textarea
              rows={3}
              value={(options.sources?.metaSources ?? []).join(", ")}
              onChange={(e) =>
                patch({
                  sources: {
                    metaSources: e.target.value
                      .split(/[,，\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="javbus, jav321"
            />
          </label>
        );
      default:
        return null;
    }
  }

  return (
    <Modal
      open={open}
      title="手动任务 · 高级设置"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {COPY.close}
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            {COPY.save}
          </button>
        </>
      }
    >
      <div className="advanced-job-modal">
        <div className="settings-tabs advanced-job-tabs">
          {JOB_ADVANCED_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-tab${tab === item.id ? " active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="switch block advanced-global-toggle">
          <input
            type="checkbox"
            checked={isUsingGlobal(options, tab)}
            onChange={(e) => patchTabGlobal(tab, e.target.checked)}
          />
          <span>使用全局配置</span>
        </label>

        <div className="advanced-job-panel">{renderFields()}</div>
      </div>
    </Modal>
  );
}
