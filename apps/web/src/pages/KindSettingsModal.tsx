import { useEffect, useMemo, useState } from "react";
import { fetchKinds, fetchScrapeConfig, saveScrapeConfig, updateKind, type KindRow } from "../api";
import {
  AdvancedSettingsShell,
} from "../components/advancedSettings/AdvancedSettingsShell";
import {
  OrganizeFields,
  Panel,
  seedOrganize,
} from "../components/advancedSettings/fields";
import { FolderPicker } from "../components/FolderPicker";
import { KindSourcesSettingsView } from "../components/KindSourcesSettingsView";
import { SettingRow } from "../components/SettingRow";
import { DownloadSettingsPanel } from "./DownloadSettingsPanel";
import { MetadataSettingsPanel } from "./MetadataSettingsPanel";
import { NamingSettingsPanel } from "./NamingSettingsPanel";
import { NfoSettingsPanel } from "./NfoSettingsPanel";
import { WatermarkSettingsPanel } from "./WatermarkSettingsPanel";
import {
  JOB_ADVANCED_TABS,
  applyJobDownload,
  applyJobMetadata,
  applyJobNaming,
  applyJobNfo,
  applyJobWatermark,
  scrapeToJobDownload,
  scrapeToJobMetadata,
  scrapeToJobNaming,
  scrapeToJobNfo,
  scrapeToJobWatermark,
  type JobOptionsTab,
  type JobWatermarkOptions,
} from "../lib/jobOptions";
import type { NotifyFn } from "../lib/notify";
import { displayRelativePath, normalizeRelativePath } from "../lib/paths";
import type { OrganizeConfig, ProviderCatalogRow, ScrapeConfig } from "../types";
import {
  defaultDownload,
  defaultMetadata,
  defaultWatermark,
  ensureProfile,
  toKindDraft,
  type KindDraft,
  type ProfileDraft,
} from "./kindSettings/drafts";

type Props = {
  open: boolean;
  kind: KindRow | null;
  usedSources: Map<string, string>;
  usedLibraries: Map<string, string>;
  notify: NotifyFn;
  onClose: () => void;
  onSaved: () => void;
};


export function KindSettingsModal({
  open,
  kind,
  usedSources,
  usedLibraries,
  notify,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<JobOptionsTab>("organize");
  const [kindDraft, setKindDraft] = useState<KindDraft | null>(null);
  const [kindBaseline, setKindBaseline] = useState<KindDraft | null>(null);
  const [scrape, setScrape] = useState<ScrapeConfig | null>(null);
  const [organize, setOrganize] = useState<OrganizeConfig | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>([]);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<string>("");
  const [scrapeBaseline, setScrapeBaseline] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !kind) return;
    setTab("organize");
    setLoading(true);
    void (async () => {
      try {
        const [scrapeData, kindsData] = await Promise.all([fetchScrapeConfig(), fetchKinds()]);
        setScrape(scrapeData.config);
        setScrapeBaseline(JSON.stringify(scrapeData.config));
        setCatalog(scrapeData.catalog ?? []);
        setOrganize(kindsData.organize);
        const fresh = kindsData.kinds.find((k) => k.id === kind.id) ?? kind;
        const kd = toKindDraft(fresh, kindsData.organize);
        setKindDraft(kd);
        setKindBaseline(kd);
        const pf = ensureProfile(scrapeData.config, kind.id);
        setProfile(pf);
        setProfileBaseline(JSON.stringify(pf));
      } catch (e) {
        notify("error", e, "加载分区配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, kind?.id, notify]);

  const dirty = useMemo(() => {
    if (!kindDraft || !kindBaseline || !profile || !scrape) return false;
    const kindDirty = JSON.stringify(kindDraft) !== JSON.stringify(kindBaseline);
    const profileDirty = JSON.stringify(profile) !== profileBaseline;
    const scrapeDirty = JSON.stringify(scrape) !== scrapeBaseline;
    return kindDirty || profileDirty || scrapeDirty;
  }, [kindDraft, kindBaseline, profile, profileBaseline, scrape, scrapeBaseline]);

  function patchKind(next: Partial<KindDraft>) {
    setKindDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchProfile(next: Partial<ProfileDraft>) {
    setProfile((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchUseGlobal(key: keyof NonNullable<ProfileDraft["useGlobal"]>, value: boolean) {
    setProfile((prev) => {
      if (!prev || !scrape) return prev;
      let next: ProfileDraft = {
        ...prev,
        useGlobal: { ...prev.useGlobal, [key]: value },
      };
      if (!value) {
        if (key === "naming") {
          next = {
            ...next,
            directoryTemplate: scrape.naming?.directoryTemplate || next.directoryTemplate,
            fileNameTemplate: scrape.naming?.fileNameTemplate || next.fileNameTemplate,
            nameSuffixTemplate: scrape.naming?.nameSuffixTemplate ?? next.nameSuffixTemplate ?? "",
            posterCrop: scrape.naming?.posterCrop || next.posterCrop,
          };
        }
        if (key === "download") {
          next.download = { ...defaultDownload(scrape), ...prev.download };
        }
        if (key === "watermark") {
          next.watermark = { ...defaultWatermark(scrape), ...prev.watermark };
        }
        if (key === "metadata") {
          next.metadata = { ...defaultMetadata(scrape), ...prev.metadata };
        }
      }
      return next;
    });
  }

  function tabUsesGlobal(): boolean {
    if (!kindDraft || !profile) return true;
    if (tab === "organize") return kindDraft.useGlobalOrganize;
    return profile.useGlobal?.[tab] !== false;
  }

  function setTabUsesGlobal(value: boolean) {
    if (tab === "organize") {
      patchKind({ useGlobalOrganize: value });
      return;
    }
    patchUseGlobal(tab, value);
  }

  function close() {
    if (dirty && !window.confirm("有未保存的修改，确定关闭？")) return;
    onClose();
  }

  async function save() {
    if (!kind || !kindDraft || !profile || !scrape) return;
    setSaving(true);
    try {
      const kindPatch: Parameters<typeof updateKind>[1] = {
        enabled: kind.enabled,
        label: kindDraft.label,
        sourceRoot: normalizeRelativePath(kindDraft.sourceRoot),
        libraryRoot: normalizeRelativePath(kindDraft.libraryRoot),
        useGlobalOrganize: kindDraft.useGlobalOrganize,
      };
      if (!kindDraft.useGlobalOrganize) {
        kindPatch.organizeMode = kindDraft.organizeMode;
        kindPatch.organizeFallback = kindDraft.organizeFallback;
        kindPatch.metadataDir = kindDraft.metadataDir;
        kindPatch.deleteMetadataOnFail = kindDraft.deleteMetadataOnFail;
      }
      await updateKind(kind.id, kindPatch);

      const ug = profile.useGlobal ?? {};
      const nextProfile: ProfileDraft = {
        metaSources: profile.metaSources,
        coverSources: profile.coverSources,
        directoryTemplate: profile.directoryTemplate,
        fileNameTemplate: profile.fileNameTemplate,
        nameSuffixTemplate: profile.nameSuffixTemplate,
        posterCrop: profile.posterCrop,
        fieldPriority: ug.sources === false ? profile.fieldPriority : undefined,
        useGlobal: {
          download: ug.download !== false,
          naming: ug.naming !== false,
          watermark: ug.watermark !== false,
          metadata: ug.metadata !== false,
          nfo: ug.nfo !== false,
          sources: ug.sources !== false,
        },
      };
      if (ug.download === false) nextProfile.download = profile.download;
      if (ug.watermark === false) nextProfile.watermark = profile.watermark;
      if (ug.metadata === false) nextProfile.metadata = profile.metadata;
      if (ug.nfo === false) nextProfile.nfoMergeStrategy = profile.nfoMergeStrategy;

      const nextScrape: ScrapeConfig = {
        ...scrape,
        kindProfiles: {
          ...scrape.kindProfiles,
          [kind.id]: nextProfile,
        },
      };
      const { config: saved } = await saveScrapeConfig(nextScrape);
      setScrape(saved);
      setScrapeBaseline(JSON.stringify(saved));
      const pf = ensureProfile(saved, kind.id);
      setProfile(pf);
      setProfileBaseline(JSON.stringify(pf));
      setKindBaseline({ ...kindDraft });
      notify("ok", `「${kindDraft.label}」分区设置已保存`);
      onSaved();
      onClose();
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const titlePath =
    displayRelativePath(kind?.sourceRoot || kind?.sourceAbs || "") !== "—"
      ? displayRelativePath(kind?.sourceRoot || kind?.sourceAbs || "")
      : kind?.label || "";

  const usingGlobal = tabUsesGlobal();

  function renderFields() {
    if (!kindDraft || !profile || !scrape || !organize) return null;

    const pathHeader = (
      <Panel title="分区路径">
        <SettingRow label="来源目录" layout="stack">
          <FolderPicker
            variant="inline"
            pickerTitle="选择刮削路径"
            value={kindDraft.sourceRoot}
            onChange={(relative) => patchKind({ sourceRoot: relative })}
            usedBy={usedSources}
            currentLabel={kindDraft.label}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
        <SettingRow label="整理目录" layout="stack">
          <FolderPicker
            variant="inline"
            pickerTitle="选择整理目录"
            value={kindDraft.libraryRoot}
            onChange={(relative) => patchKind({ libraryRoot: relative })}
            usedBy={usedLibraries}
            currentLabel={kindDraft.label}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
      </Panel>
    );

    if (tab === "organize") {
      if (usingGlobal) {
        return <div className="advanced-job-settings">{pathHeader}</div>;
      }
      return (
        <OrganizeFields
          variant="kind"
          header={pathHeader}
          value={seedOrganize(organize, {
            organizeMode: kindDraft.organizeMode,
            organizeFallback: kindDraft.organizeFallback,
            metadataDir: kindDraft.metadataDir,
            deleteMetadataOnFail: kindDraft.deleteMetadataOnFail,
          })}
          onChange={(org) =>
            patchKind({
              organizeMode: org.organizeMode || kindDraft.organizeMode,
              organizeFallback: org.organizeFallback || kindDraft.organizeFallback,
              metadataDir: org.metadataDir ?? "",
              deleteMetadataOnFail: Boolean(org.deleteMetadataOnFail),
            })
          }
          notify={notify}
        />
      );
    }

    if (usingGlobal) return null;

    switch (tab) {
      case "download":
        return (
          <DownloadSettingsPanel
            notify={notify}
            embedded
            value={applyJobDownload(scrape, profile.download)}
            onChange={(next) => {
              patchProfile({ download: scrapeToJobDownload(next) });
              setScrape((prev) =>
                prev ? { ...prev, kindProfiles: next.kindProfiles } : prev,
              );
            }}
          />
        );
      case "naming":
        return (
          <NamingSettingsPanel
            notify={notify}
            embedded
            value={applyJobNaming(scrape, {
              directoryTemplate: profile.directoryTemplate,
              fileNameTemplate: profile.fileNameTemplate,
              nameSuffixTemplate: profile.nameSuffixTemplate,
              posterCrop: profile.posterCrop,
            })}
            onChange={(next) => {
              const naming = scrapeToJobNaming(next);
              patchProfile({
                directoryTemplate: naming.directoryTemplate || profile.directoryTemplate,
                fileNameTemplate: naming.fileNameTemplate || profile.fileNameTemplate,
                nameSuffixTemplate: naming.nameSuffixTemplate ?? profile.nameSuffixTemplate,
                posterCrop: naming.posterCrop || profile.posterCrop,
              });
              setScrape(next);
            }}
          />
        );
      case "watermark":
        return (
          <WatermarkSettingsPanel
            notify={notify}
            embedded
            value={applyJobWatermark(scrape, profile.watermark as JobWatermarkOptions | undefined)}
            onChange={(next) =>
              patchProfile({ watermark: scrapeToJobWatermark(next) })
            }
          />
        );
      case "metadata":
        return (
          <MetadataSettingsPanel
            notify={notify}
            embedded
            value={applyJobMetadata(scrape, profile.metadata)}
            onChange={(next) =>
              patchProfile({ metadata: scrapeToJobMetadata(next) })
            }
          />
        );
      case "nfo":
        return (
          <NfoSettingsPanel
            notify={notify}
            embedded
            value={applyJobNfo(scrape, { mergeStrategy: profile.nfoMergeStrategy })}
            onChange={(next) => {
              const nfo = scrapeToJobNfo(next);
              patchProfile({
                nfoMergeStrategy:
                  nfo.mergeStrategy === "prefer_nfo" || nfo.mergeStrategy === "prefer_scraped"
                    ? nfo.mergeStrategy
                    : profile.nfoMergeStrategy,
              });
              setScrape(next);
            }}
          />
        );
      case "sources":
        return (
          <KindSourcesSettingsView
            kindLabel={kindDraft.label || kind?.label || "分区"}
            scrape={scrape}
            catalog={catalog}
            profile={{
              metaSources: profile.metaSources,
              coverSources: profile.coverSources,
              fieldPriority: profile.fieldPriority,
            }}
            onScrapeChange={(next, nextCatalog) => {
              setScrape(next);
              if (nextCatalog) setCatalog(nextCatalog);
            }}
            onProfileChange={(patch) => patchProfile(patch)}
            notify={notify}
          />
        );
      default:
        return null;
    }
  }

  return (
    <AdvancedSettingsShell
      open={open && !!kind}
      title="监控目录设置"
      subtitle={titlePath || undefined}
      className="modal-kind-settings"
      tabs={[...JOB_ADVANCED_TABS]}
      tab={tab}
      onTabChange={setTab}
      useGlobal={usingGlobal}
      onUseGlobalChange={setTabUsesGlobal}
      loading={loading || !kindDraft || !profile || !scrape}
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="btn primary solid"
            disabled={!dirty || saving || loading}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存修改"}
          </button>
          <button type="button" className="btn text" onClick={close}>
            关闭
          </button>
        </>
      }
    >
      {renderFields()}
    </AdvancedSettingsShell>
  );
}
