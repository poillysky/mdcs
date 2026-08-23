import { useEffect, useMemo, useState } from "react";
import { fetchKinds, fetchScrapeConfig, saveScrapeConfig, updateKind, type KindRow } from "../api";
import { FolderPicker } from "../components/FolderPicker";
import { Modal } from "../components/Modal";
import { SettingRow } from "../components/SettingRow";
import { FieldPriorityEditor } from "../components/FieldPriorityEditor";
import { SourceChainEditor } from "../components/SourceChainEditor";
import type { NotifyFn } from "../lib/notify";
import type { OrganizeConfig, ProviderCatalogRow, ScrapeConfig } from "../types";

type TabId = "organize" | "download" | "naming" | "watermark" | "metadata" | "nfo" | "sources";

const TABS: { id: TabId; label: string }[] = [
  { id: "organize", label: "整理" },
  { id: "download", label: "下载" },
  { id: "naming", label: "命名" },
  { id: "watermark", label: "水印" },
  { id: "metadata", label: "元数据" },
  { id: "nfo", label: "NFO" },
  { id: "sources", label: "数据源" },
];

const ORGANIZE_MODES = [
  { value: "hardlink", label: "硬链接" },
  { value: "softlink", label: "软链接" },
  { value: "inplace", label: "原地整理" },
  { value: "copy", label: "复制" },
  { value: "move", label: "移动" },
] as const;

type KindDraft = {
  enabled: boolean;
  label: string;
  sourceRoot: string;
  libraryRoot: string;
  useGlobalOrganize: boolean;
  organizeMode: string;
  organizeFallback: string;
  metadataDir: string;
  deleteMetadataOnFail: boolean;
};

type ProfileDraft = ScrapeConfig["kindProfiles"][string];

type Props = {
  open: boolean;
  kind: KindRow | null;
  usedSources: Map<string, string>;
  usedLibraries: Map<string, string>;
  notify: NotifyFn;
  onClose: () => void;
  onSaved: () => void;
};

function defaultDownload(cfg: ScrapeConfig): NonNullable<ScrapeConfig["download"]> {
  return {
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
    ...cfg.download,
  };
}

function defaultWatermark(cfg: ScrapeConfig): NonNullable<ScrapeConfig["watermark"]> {
  return {
    enabled: false,
    position: "top-right",
    scalePercent: 12,
    markSubtitle: true,
    markCracked: true,
    markLeak: true,
    markUncensored: true,
    markCensored: false,
    ...cfg.watermark,
  };
}

function defaultMetadata(cfg: ScrapeConfig): NonNullable<ScrapeConfig["metadata"]> {
  return {
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
    ...cfg.metadata,
  };
}

function toKindDraft(k: KindRow, organize: OrganizeConfig | null): KindDraft {
  return {
    enabled: k.enabled,
    label: k.label,
    sourceRoot: k.sourceRoot,
    libraryRoot: k.libraryRoot,
    useGlobalOrganize: k.useGlobalOrganize !== false,
    organizeMode: k.organizeMode || organize?.defaultMode || "hardlink",
    organizeFallback: k.organizeFallback || organize?.defaultFallback || "copy",
    metadataDir: k.metadataDir ?? "",
    deleteMetadataOnFail:
      typeof k.deleteMetadataOnFail === "boolean"
        ? k.deleteMetadataOnFail
        : Boolean(organize?.deleteMetadataOnFail),
  };
}

function ensureProfile(cfg: ScrapeConfig, kindId: string): ProfileDraft {
  const p = cfg.kindProfiles[kindId];
  return {
    metaSources: p?.metaSources ?? [],
    coverSources: p?.coverSources ?? [],
    directoryTemplate: p?.directoryTemplate ?? "{category}/{studio}/{number}",
    fileNameTemplate: p?.fileNameTemplate ?? "{number}",
    nameSuffixTemplate: p?.nameSuffixTemplate ?? "",
    posterCrop: p?.posterCrop ?? "right",
    fieldPriority: p?.fieldPriority,
    useGlobal: {
      download: p?.useGlobal?.download !== false,
      naming: p?.useGlobal?.naming !== false,
      watermark: p?.useGlobal?.watermark !== false,
      metadata: p?.useGlobal?.metadata !== false,
      nfo: p?.useGlobal?.nfo !== false,
      sources: p?.useGlobal?.sources !== false,
    },
    download: { ...defaultDownload(cfg), ...p?.download },
    watermark: { ...defaultWatermark(cfg), ...p?.watermark },
    metadata: { ...defaultMetadata(cfg), ...p?.metadata },
    nfoMergeStrategy: p?.nfoMergeStrategy ?? cfg.nfoMergeStrategy ?? "prefer_scraped",
  };
}

function GlobalToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingRow label="使用全局配置">
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </label>
    </SettingRow>
  );
}

export function KindSettingsModal({
  open,
  kind,
  usedSources,
  usedLibraries,
  notify,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<TabId>("organize");
  const [kindDraft, setKindDraft] = useState<KindDraft | null>(null);
  const [kindBaseline, setKindBaseline] = useState<KindDraft | null>(null);
  const [scrape, setScrape] = useState<ScrapeConfig | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>([]);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<string>("");
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
        setCatalog(scrapeData.catalog ?? []);
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
    if (!kindDraft || !kindBaseline || !profile) return false;
    const kindDirty = JSON.stringify(kindDraft) !== JSON.stringify(kindBaseline);
    const profileDirty = JSON.stringify(profile) !== profileBaseline;
    return kindDirty || profileDirty;
  }, [kindDraft, kindBaseline, profile, profileBaseline]);

  function patchKind(next: Partial<KindDraft>) {
    setKindDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchProfile(next: Partial<ProfileDraft>) {
    setProfile((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchUseGlobal(key: keyof NonNullable<ProfileDraft["useGlobal"]>, value: boolean) {
    setProfile((prev) => {
      if (!prev) return prev;
      let next: ProfileDraft = {
        ...prev,
        useGlobal: { ...prev.useGlobal, [key]: value },
      };
      // 切到专属命名时，用当前全局模板作初值，避免空白
      if (key === "naming" && value === false && scrape?.naming) {
        next = {
          ...next,
          directoryTemplate: scrape.naming.directoryTemplate || next.directoryTemplate,
          fileNameTemplate: scrape.naming.fileNameTemplate || next.fileNameTemplate,
          nameSuffixTemplate:
            scrape.naming.nameSuffixTemplate ?? next.nameSuffixTemplate ?? "",
          posterCrop: scrape.naming.posterCrop || next.posterCrop,
        };
      }
      return next;
    });
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
        sourceRoot: kindDraft.sourceRoot,
        libraryRoot: kindDraft.libraryRoot,
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
      const pf = ensureProfile(saved, kind.id);
      setProfile(pf);
      setProfileBaseline(JSON.stringify(pf));
      setKindBaseline({ ...kindDraft });
      notify("ok", `「${kindDraft.label}」分区设置已保存`);
      onSaved();
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const titlePath = kind?.sourceRoot || kind?.sourceAbs || kind?.label || "";
  const title = `监控目录设置${titlePath ? ` - ${titlePath}` : ""}`;

  return (
    <Modal
      open={open && !!kind}
      title={title}
      wide
      onClose={close}
      footer={
        <button type="button" className="btn primary" disabled={!dirty || saving || loading} onClick={() => void save()}>
          {saving ? "保存中…" : "保存修改"}
        </button>
      }
    >
      <div className="kind-settings">
        <nav className="kind-settings-tabs" aria-label="分区设置分类">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`kind-settings-tab${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading || !kindDraft || !profile || !scrape ? (
          <div className="empty-block">加载配置…</div>
        ) : (
          <div className="kind-settings-body cfg-modal-body">
            {tab === "organize" ? (
              <>
                <GlobalToggle
                  checked={kindDraft.useGlobalOrganize}
                  onChange={(v) => patchKind({ useGlobalOrganize: v })}
                />
                <SettingRow label="整理目录" layout="stack">
                  <FolderPicker
                    value={kindDraft.libraryRoot}
                    onChange={(relative) => patchKind({ libraryRoot: relative })}
                    usedBy={usedLibraries}
                    currentLabel={kindDraft.label}
                    onError={(msg) => notify("error", msg, "读取目录失败")}
                  />
                </SettingRow>
                <SettingRow label="来源目录" layout="stack">
                  <FolderPicker
                    value={kindDraft.sourceRoot}
                    onChange={(relative) => patchKind({ sourceRoot: relative })}
                    usedBy={usedSources}
                    currentLabel={kindDraft.label}
                    onError={(msg) => notify("error", msg, "读取目录失败")}
                  />
                </SettingRow>
                {!kindDraft.useGlobalOrganize ? (
                  <>
                    <SettingRow label="整理模式">
                      <select
                        className="org-select"
                        value={kindDraft.organizeMode}
                        onChange={(e) => patchKind({ organizeMode: e.target.value })}
                      >
                        {ORGANIZE_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </SettingRow>
                    {kindDraft.organizeMode === "hardlink" ||
                    kindDraft.organizeMode === "softlink" ? (
                      <SettingRow
                        label="硬链/软链失败降级"
                        hint="跨盘或权限失败时：复制继续，或直接失败"
                      >
                        <select
                          className="org-select"
                          value={kindDraft.organizeFallback}
                          onChange={(e) => patchKind({ organizeFallback: e.target.value })}
                        >
                          <option value="copy">降级为复制</option>
                          <option value="fail">直接失败</option>
                        </select>
                      </SettingRow>
                    ) : null}
                    <SettingRow
                      label="元数据目录"
                      hint="可选，视频以外的文件整理到另外的目录"
                      layout="stack"
                    >
                      <FolderPicker
                        value={kindDraft.metadataDir}
                        onChange={(relative) => patchKind({ metadataDir: relative })}
                        currentLabel={kindDraft.label}
                        onError={(msg) => notify("error", msg, "读取目录失败")}
                      />
                    </SettingRow>
                    <SettingRow label="刮削出错时删除元数据目录">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={kindDraft.deleteMetadataOnFail}
                          onChange={(e) => patchKind({ deleteMetadataOnFail: e.target.checked })}
                        />
                        <span />
                      </label>
                    </SettingRow>
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "download" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.download !== false}
                  onChange={(v) => patchUseGlobal("download", v)}
                />
                {profile.useGlobal?.download === false ? (
                  <>
                    {(
                      [
                        ["downloadPoster", "下载海报"],
                        ["downloadThumb", "下载缩略图"],
                        ["downloadFanart", "下载剧照"],
                        ["amazonHdPoster", "Amazon 高清海报"],
                        ["tenhowHdPoster", "Tenhow 高清海报"],
                        ["amazonStrictMode", "Amazon 严格模式"],
                        ["preferHighResPoster", "DMM 优先高清"],
                      ] as const
                    ).map(([key, label]) => (
                      <SettingRow key={key} label={label}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={Boolean(profile.download?.[key])}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const download = { ...profile.download, [key]: checked };
                              if (key === "amazonHdPoster") download.skipAmazon = !checked;
                              patchProfile({ download });
                            }}
                          />
                          <span />
                        </label>
                      </SettingRow>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "naming" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.naming !== false}
                  onChange={(v) => patchUseGlobal("naming", v)}
                />
                {profile.useGlobal?.naming !== false ? (
                  <p className="set-section-sub">
                    已使用「设置 → 命名」全局规则；下方分区模板仅在关闭「使用全局」后生效。
                  </p>
                ) : null}
                {profile.useGlobal?.naming === false ? (
                  <>
                    <SettingRow label="目录模板" layout="stack">
                      <input
                        className="org-input"
                        value={profile.directoryTemplate}
                        onChange={(e) => patchProfile({ directoryTemplate: e.target.value })}
                      />
                    </SettingRow>
                    <SettingRow label="文件名模板" layout="stack">
                      <input
                        className="org-input"
                        value={profile.fileNameTemplate ?? "{number}"}
                        onChange={(e) => patchProfile({ fileNameTemplate: e.target.value })}
                      />
                    </SettingRow>
                    <SettingRow label="文件名后缀" layout="stack">
                      <input
                        className="org-input"
                        value={profile.nameSuffixTemplate ?? ""}
                        onChange={(e) => patchProfile({ nameSuffixTemplate: e.target.value })}
                        placeholder="如 -{mosaic}"
                      />
                    </SettingRow>
                    <SettingRow label="海报裁剪">
                      <select
                        className="org-select"
                        value={profile.posterCrop}
                        onChange={(e) => patchProfile({ posterCrop: e.target.value })}
                      >
                        <option value="right">右裁</option>
                        <option value="none">不裁</option>
                        <option value="face">人脸（失败居中）</option>
                      </select>
                    </SettingRow>
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "watermark" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.watermark !== false}
                  onChange={(v) => patchUseGlobal("watermark", v)}
                />
                {profile.useGlobal?.watermark === false ? (
                  <>
                    <SettingRow label="启用水印">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(profile.watermark?.enabled)}
                          onChange={(e) =>
                            patchProfile({
                              watermark: { ...profile.watermark, enabled: e.target.checked },
                            })
                          }
                        />
                        <span />
                      </label>
                    </SettingRow>
                    <SettingRow label="位置">
                      <select
                        className="org-select"
                        value={profile.watermark?.position || "top-right"}
                        onChange={(e) =>
                          patchProfile({
                            watermark: { ...profile.watermark, position: e.target.value },
                          })
                        }
                      >
                        <option value="top-left">左上</option>
                        <option value="top-right">右上</option>
                        <option value="bottom-left">左下</option>
                        <option value="bottom-right">右下</option>
                      </select>
                    </SettingRow>
                    <SettingRow label="缩放 %">
                      <input
                        className="org-input"
                        type="number"
                        min={4}
                        max={40}
                        value={profile.watermark?.scalePercent ?? 12}
                        onChange={(e) =>
                          patchProfile({
                            watermark: {
                              ...profile.watermark,
                              scalePercent: Number(e.target.value) || 12,
                            },
                          })
                        }
                      />
                    </SettingRow>
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "metadata" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.metadata !== false}
                  onChange={(v) => patchUseGlobal("metadata", v)}
                />
                {profile.useGlobal?.metadata === false ? (
                  <>
                    {(
                      [
                        ["strictMode", "严格字段模式"],
                        ["requireCover", "必须有封面"],
                        ["trimPlot", "裁剪简介空白"],
                        ["autoTranslateTitle", "自动翻译标题"],
                        ["autoTranslateOutline", "自动翻译简介"],
                      ] as const
                    ).map(([key, label]) => (
                      <SettingRow key={key} label={label}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={Boolean(profile.metadata?.[key])}
                            onChange={(e) =>
                              patchProfile({
                                metadata: { ...profile.metadata, [key]: e.target.checked },
                              })
                            }
                          />
                          <span />
                        </label>
                      </SettingRow>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "nfo" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.nfo !== false}
                  onChange={(v) => patchUseGlobal("nfo", v)}
                />
                {profile.useGlobal?.nfo === false ? (
                  <SettingRow label="合并策略" hint="重刮/重整理时的字段优先级">
                    <select
                      className="org-select"
                      value={profile.nfoMergeStrategy || "prefer_scraped"}
                      onChange={(e) =>
                        patchProfile({
                          nfoMergeStrategy: e.target.value as ProfileDraft["nfoMergeStrategy"],
                        })
                      }
                    >
                      <option value="prefer_scraped">刮削结果覆盖</option>
                      <option value="prefer_nfo">本地非空优先</option>
                    </select>
                  </SettingRow>
                ) : null}
              </>
            ) : null}

            {tab === "sources" ? (
              <>
                <GlobalToggle
                  checked={profile.useGlobal?.sources !== false}
                  onChange={(v) => patchUseGlobal("sources", v)}
                />
                <SettingRow
                  label="元数据源链"
                  hint="靠前优先；多源聚合按此顺序回退"
                  layout="stack"
                >
                  <SourceChainEditor
                    values={profile.metaSources}
                    onChange={(metaSources) => patchProfile({ metaSources })}
                    catalog={catalog}
                    disabled={profile.useGlobal?.sources !== false}
                  />
                </SettingRow>
                <SettingRow
                  label="封面源链"
                  hint="靠前优先；用于封面/海报抓取顺序"
                  layout="stack"
                >
                  <SourceChainEditor
                    values={profile.coverSources}
                    onChange={(coverSources) => patchProfile({ coverSources })}
                    catalog={catalog}
                    disabled={profile.useGlobal?.sources !== false}
                  />
                </SettingRow>
                {profile.useGlobal?.sources === false ? (
                  <SettingRow
                    label="字段优先级"
                    hint="覆盖全局 merge 字段链；留空继承全局"
                    layout="stack"
                  >
                    <FieldPriorityEditor
                      fieldPriority={profile.fieldPriority ?? {}}
                      globalFieldPriority={scrape?.fieldPriority}
                      onChange={(fieldPriority) => patchProfile({ fieldPriority })}
                    />
                  </SettingRow>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
