import { useEffect, useState } from "react";
import { fetchKinds, fetchScrapeConfig } from "../api";
import {
  AdvancedSettingsShell,
} from "./advancedSettings/AdvancedSettingsShell";
import { OrganizeFields } from "./advancedSettings/fields";
import { JobSourcesSettingsView } from "./JobSourcesSettingsView";
import { DownloadSettingsPanel } from "../pages/DownloadSettingsPanel";
import { MetadataSettingsPanel } from "../pages/MetadataSettingsPanel";
import { NamingSettingsPanel } from "../pages/NamingSettingsPanel";
import { NfoSettingsPanel } from "../pages/NfoSettingsPanel";
import { WatermarkSettingsPanel } from "../pages/WatermarkSettingsPanel";
import {
  JOB_ADVANCED_TABS,
  applyJobDownload,
  applyJobMetadata,
  applyJobNaming,
  applyJobNfo,
  applyJobWatermark,
  defaultJobOptions,
  isUsingGlobal,
  scrapeToJobDownload,
  scrapeToJobMetadata,
  scrapeToJobNaming,
  scrapeToJobNfo,
  scrapeToJobWatermark,
  seedJobOrganize,
  seedJobSources,
  type JobOptions,
  type JobOptionsTab,
  type JobOrganizeOptions,
  type JobSourcesOptions,
} from "../lib/jobOptions";
import type { NotifyFn } from "../lib/notify";
import type { OrganizeConfig, ProviderCatalogRow, ScrapeConfig } from "../types";

type Props = {
  open: boolean;
  value: JobOptions;
  onChange: (next: JobOptions) => void;
  onClose: () => void;
  notify: NotifyFn;
  onSavePreset?: () => void;
  onExportPresets?: () => void;
  onImportPresets?: () => void;
};

export function JobAdvancedSettingsModal({
  open,
  value,
  onChange,
  onClose,
  notify,
  onSavePreset,
  onExportPresets,
  onImportPresets,
}: Props) {
  const [tab, setTab] = useState<JobOptionsTab>("organize");
  const [loading, setLoading] = useState(false);
  const [scrape, setScrape] = useState<ScrapeConfig | null>(null);
  const [organize, setOrganize] = useState<OrganizeConfig | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>([]);

  const options = { ...defaultJobOptions(), ...value };
  const usingGlobal = isUsingGlobal(options, tab);

  useEffect(() => {
    if (!open) return;
    setTab("organize");
    setLoading(true);
    void (async () => {
      try {
        const [scrapeData, kindsData] = await Promise.all([fetchScrapeConfig(), fetchKinds()]);
        setScrape(scrapeData.config);
        setCatalog(scrapeData.catalog ?? []);
        setOrganize(kindsData.organize);
      } catch (e) {
        notify("error", e, "加载高级设置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, notify]);

  function patch(partial: Partial<JobOptions>) {
    onChange({ ...options, ...partial });
  }

  function seedTab(nextTab: JobOptionsTab, next: JobOptions): JobOptions {
    if (!scrape || !organize) return next;
    if (nextTab === "organize") {
      return { ...next, organize: seedJobOrganize(organize, next.organize) };
    }
    if (nextTab === "download") {
      return { ...next, download: scrapeToJobDownload(applyJobDownload(scrape, next.download)) };
    }
    if (nextTab === "naming") {
      return { ...next, naming: scrapeToJobNaming(applyJobNaming(scrape, next.naming)) };
    }
    if (nextTab === "watermark") {
      return {
        ...next,
        watermark: scrapeToJobWatermark(applyJobWatermark(scrape, next.watermark)),
      };
    }
    if (nextTab === "metadata") {
      return {
        ...next,
        metadata: scrapeToJobMetadata(applyJobMetadata(scrape, next.metadata)),
      };
    }
    if (nextTab === "nfo") {
      return { ...next, nfo: scrapeToJobNfo(applyJobNfo(scrape, next.nfo)) };
    }
    if (nextTab === "sources") {
      return { ...next, sources: seedJobSources(scrape, next.sources) };
    }
    return next;
  }

  function patchTabGlobal(useGlobal: boolean) {
    let next: JobOptions = {
      ...options,
      useGlobal: { ...options.useGlobal, [tab]: useGlobal },
    };
    if (!useGlobal) next = seedTab(tab, next);
    onChange(next);
  }

  function renderFields() {
    if (!scrape || !organize) return null;
    if (usingGlobal) return null;

    switch (tab) {
      case "organize":
        return (
          <OrganizeFields
            value={seedJobOrganize(organize, options.organize)}
            onChange={(organize: JobOrganizeOptions) => patch({ organize })}
            notify={notify}
          />
        );
      case "download":
        return (
          <DownloadSettingsPanel
            notify={notify}
            embedded
            value={applyJobDownload(scrape, options.download)}
            onChange={(next) => patch({ download: scrapeToJobDownload(next) })}
          />
        );
      case "naming":
        return (
          <NamingSettingsPanel
            notify={notify}
            embedded
            value={applyJobNaming(scrape, options.naming)}
            onChange={(next) => patch({ naming: scrapeToJobNaming(next) })}
          />
        );
      case "watermark":
        return (
          <WatermarkSettingsPanel
            notify={notify}
            embedded
            value={applyJobWatermark(scrape, options.watermark)}
            onChange={(next) => patch({ watermark: scrapeToJobWatermark(next) })}
          />
        );
      case "metadata":
        return (
          <MetadataSettingsPanel
            notify={notify}
            embedded
            value={applyJobMetadata(scrape, options.metadata)}
            onChange={(next) => patch({ metadata: scrapeToJobMetadata(next) })}
          />
        );
      case "nfo":
        return (
          <NfoSettingsPanel
            notify={notify}
            embedded
            value={applyJobNfo(scrape, options.nfo)}
            onChange={(next) => patch({ nfo: scrapeToJobNfo(next) })}
          />
        );
      case "sources":
        return (
          <JobSourcesSettingsView
            scrape={scrape}
            catalog={catalog}
            value={seedJobSources(scrape, options.sources) as JobSourcesOptions}
            onChange={(sources) => patch({ sources })}
            notify={notify}
          />
        );
      default:
        return null;
    }
  }

  return (
    <AdvancedSettingsShell
      open={open}
      title="手动任务 - 高级设置"
      className="modal-advanced-job"
      tabs={[...JOB_ADVANCED_TABS]}
      tab={tab}
      onTabChange={setTab}
      useGlobal={usingGlobal}
      onUseGlobalChange={patchTabGlobal}
      loading={loading}
      onClose={onClose}
      footer={
        <>
          <div className="advanced-job-foot-left">
            {onSavePreset ? (
              <button type="button" className="btn text" onClick={onSavePreset}>
                保存为预设
              </button>
            ) : null}
            {onExportPresets ? (
              <button type="button" className="btn text" onClick={onExportPresets}>
                导出预设
              </button>
            ) : null}
            {onImportPresets ? (
              <button type="button" className="btn text" onClick={onImportPresets}>
                导入预设
              </button>
            ) : null}
          </div>
          <div className="advanced-job-foot-right">
            <button type="button" className="btn primary solid" onClick={onClose}>
              保存修改
            </button>
            <button type="button" className="btn text" onClick={onClose}>
              关闭
            </button>
          </div>
        </>
      }
    >
      {renderFields()}
    </AdvancedSettingsShell>
  );
}
