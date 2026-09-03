import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  createJob,
  exportPresets,
  fetchOpsConfig,
  importPresets,
  savePreset,
  type KindRow,
} from "../api";
import { FolderPicker } from "./FolderPicker";
import { JobAdvancedSettingsModal } from "./JobAdvancedSettingsModal";
import { Modal } from "./Modal";
import { ORGANIZE_MODE_LABELS, KIND_LABELS } from "../lib/labels";
import { COPY } from "../lib/messages";
import { defaultJobOptions, type JobOptions } from "../lib/jobOptions";
import { normalizeRelativePath } from "../lib/paths";
import type { NotifyFn } from "../lib/notify";
import type { JobRow, OpsConfig } from "../types";

const ORGANIZE_MODES = ["hardlink", "softlink", "inplace", "copy", "move"] as const;

/** 与七区任务页顺序一致 */
const KIND_ORDER = [
  "japan_censored",
  "japan_gravure",
  "japan_uncensored",
  "japan_amateur",
  "fc2",
  "china",
  "western",
] as const;

type Props = {
  open: boolean;
  kinds: KindRow[];
  loading: boolean;
  defaultMode?: string;
  defaultKindIds?: string[];
  /** 从目录浏览带入的相对路径 */
  contextFolder?: string;
  onClose: () => void;
  onCreated: (job: JobRow) => void;
  notify: NotifyFn;
};

function FormBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="create-job-block">
      <div className="create-job-block-label">{label}</div>
      {hint ? <p className="create-job-block-hint">{hint}</p> : null}
      {children}
    </div>
  );
}

function normalizePath(path: string): string {
  return normalizeRelativePath(path);
}

function findKindBySource(kinds: KindRow[], path: string): KindRow | undefined {
  const norm = normalizePath(path);
  if (!norm) return undefined;
  const exact = kinds.find((k) => normalizePath(k.sourceRoot || "") === norm);
  if (exact) return exact;
  return kinds.find((k) => {
    const root = normalizePath(k.sourceRoot || "");
    return root && (norm === root || norm.startsWith(`${root}/`));
  });
}

function buildJobOptions(
  organizeMode: string,
  libraryRoot: string,
  base: JobOptions,
): JobOptions {
  return {
    ...base,
    useGlobal: { ...base.useGlobal, organize: false },
    organize: {
      ...base.organize,
      organizeMode,
      libraryRoot: libraryRoot.trim() || undefined,
    },
  };
}

export function CreateJobModal({
  open,
  kinds,
  loading,
  defaultMode = "full",
  defaultKindIds,
  contextFolder,
  onClose,
  onCreated,
  notify,
}: Props) {
  const [sourcePath, setSourcePath] = useState("");
  const [libraryPath, setLibraryPath] = useState("");
  const [organizeMode, setOrganizeMode] = useState("hardlink");
  const [selectedKindId, setSelectedKindId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [creating, setCreating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jobOptions, setJobOptions] = useState<JobOptions>(defaultJobOptions());
  const [reuseKey, setReuseKey] = useState("none");
  const [ops, setOps] = useState<OpsConfig | null>(null);
  // App 定时 refresh 会换新 kinds 引用；初始化只应在弹窗打开时跑，避免把高级设置关掉
  const kindsRef = useRef(kinds);
  kindsRef.current = kinds;
  const defaultKindIdsKey = (defaultKindIds ?? []).join(",");

  const reuseKinds = useMemo(() => {
    const map = new Map(kinds.map((k) => [k.id, k]));
    return KIND_ORDER.map((id) => map.get(id)).filter((k): k is KindRow => Boolean(k));
  }, [kinds]);

  const usedSources = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of kinds) {
      if (k.sourceRoot?.trim()) map.set(normalizePath(k.sourceRoot), k.label);
    }
    return map;
  }, [kinds]);

  const usedLibraries = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of kinds) {
      if (k.libraryRoot?.trim()) map.set(normalizePath(k.libraryRoot), k.label);
    }
    return map;
  }, [kinds]);

  const currentKind = kinds.find((k) => k.id === selectedKindId);

  function applyKindDefaults(kind: KindRow, opts?: { keepLibrary?: boolean }) {
    setSelectedKindId(kind.id);
    if (kind.sourceRoot?.trim()) setSourcePath(normalizePath(kind.sourceRoot));
    if (!opts?.keepLibrary && kind.libraryRoot?.trim()) {
      setLibraryPath(normalizePath(kind.libraryRoot));
    }
    if (!opts?.keepLibrary) {
      setOrganizeMode(kind.organizeMode || "hardlink");
    }
  }

  function applyKindConfig(kind: KindRow) {
    applyKindDefaults(kind);
  }

  useEffect(() => {
    if (!open) return;
    const kindsNow = kindsRef.current;
    const kindIds = defaultKindIdsKey ? defaultKindIdsKey.split(",") : [];
    setDryRun(false);
    setJobOptions(defaultJobOptions());
    setAdvancedOpen(false);
    setReuseKey("none");

    const kindFromContext =
      kindIds.length === 1 ? kindsNow.find((k) => k.id === kindIds[0]) : undefined;
    const folderNorm = contextFolder ? normalizePath(contextFolder) : "";
    const kindFromFolder = folderNorm ? findKindBySource(kindsNow, folderNorm) : undefined;
    const kind =
      kindFromContext ??
      kindFromFolder ??
      kindsNow.find((k) => k.enabled && k.sourceRoot?.trim());

    if (kind) {
      applyKindDefaults(kind);
      setReuseKey(kind.id);
    } else {
      setSelectedKindId("");
      setLibraryPath("");
      setOrganizeMode("hardlink");
      setReuseKey("none");
    }

    if (folderNorm) {
      setSourcePath(folderNorm);
      if (kindFromFolder) setSelectedKindId(kindFromFolder.id);
    } else if (!kind) {
      setSourcePath("");
    }

    void (async () => {
      try {
        const data = await fetchOpsConfig();
        setOps(data.config);
      } catch {
        setOps(null);
      }
    })();
  }, [open, contextFolder, defaultKindIdsKey]);

  function onSourcePathChange(path: string) {
    const norm = normalizePath(path);
    setSourcePath(norm);
    const kind = findKindBySource(kinds, norm);
    if (kind) {
      applyKindDefaults(kind, { keepLibrary: true });
      setReuseKey(kind.id);
    } else {
      setSelectedKindId("");
      setReuseKey("none");
    }
  }

  function onLibraryPathChange(path: string) {
    setLibraryPath(normalizePath(path));
    setReuseKey("none");
  }

  function onOrganizeModeChange(next: string) {
    setOrganizeMode(next);
    setReuseKey("none");
  }

  function onReuseChange(next: string) {
    setReuseKey(next);
    if (next === "none") return;
    const kind = kinds.find((k) => k.id === next);
    if (kind?.sourceRoot?.trim()) applyKindConfig(kind);
  }

  async function submit() {
    const source = normalizePath(sourcePath);
    if (!source) {
      notify("error", "请选择刮削路径");
      return;
    }

    let kind = findKindBySource(kinds, source);
    if (!kind && selectedKindId) kind = kinds.find((k) => k.id === selectedKindId);
    if (!kind) {
      notify("error", "刮削路径未绑定分区，请在分区设置中绑定来源目录");
      return;
    }

    const library = normalizePath(libraryPath);
    const mode = defaultMode || "full";
    const needsLibrary = mode === "full" || mode === "organize_only";
    if (needsLibrary && !library) {
      notify("error", "请选择整理目录");
      return;
    }

    const options = {
      ...buildJobOptions(organizeMode, library, jobOptions),
      scanPath: source,
    };
    const willMove = organizeMode === "move";
    if (willMove && !dryRun) {
      const ok = window.confirm(
        "当前任务将使用「移动」整理：源文件会从 inbox 删除。确定继续？",
      );
      if (!ok) return;
    }

    setCreating(true);
    onClose();
    try {
      const { job } = await createJob({
        kinds: [kind.id],
        mode,
        dryRun,
        options,
      });
      notify("ok", "已提交手动任务");
      onCreated(job);
    } catch (e) {
      notify("error", e, "提交失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleSavePreset() {
    if (!selectedKindId) {
      notify("error", "请先选择已绑定分区的刮削路径");
      return;
    }
    const name = window.prompt("预设名称", "");
    if (!name?.trim()) return;
    try {
      const options = buildJobOptions(organizeMode, libraryPath, jobOptions);
      const { config } = await savePreset({
        name: name.trim(),
        kinds: [selectedKindId],
        mode: "full",
        dryRun,
        options: options as Record<string, unknown>,
      });
      setOps(config);
      notify("ok", "预设已保存");
    } catch (e) {
      notify("error", e, "保存预设失败");
    }
  }

  async function handleExportPresets() {
    try {
      const data = await exportPresets();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mdcs-presets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("ok", `已导出 ${data.presets.length} 条预设`);
    } catch (e) {
      notify("error", e, "导出失败");
    }
  }

  function handleImportPresets() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          try {
            const parsed = JSON.parse(String(reader.result || "{}")) as {
              presets?: import("../types").JobPreset[];
            };
            if (!Array.isArray(parsed.presets)) {
              notify("error", "JSON 中缺少 presets 数组");
              return;
            }
            const replace = window.confirm(
              "确定用导入内容替换全部预设？\n取消 = 按名称合并",
            );
            const { config, imported } = await importPresets({
              mode: replace ? "replace" : "merge",
              presets: parsed.presets,
            });
            setOps(config);
            notify("ok", `已导入 ${imported} 条预设`);
          } catch (e) {
            notify("error", e, "导入失败");
          }
        })();
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <>
      <Modal
        open={open}
        variant="sheet"
        title="创建手动任务"
        subtitle="手动任务会在后台根据创建顺序依次执行"
        padded
        className="modal-create-job"
        onClose={() => {
          // 嵌套弹窗：Esc / 点遮罩只关上层高级设置，不连带关掉创建任务
          if (advancedOpen) {
            setAdvancedOpen(false);
            return;
          }
          onClose();
        }}
        footer={
          <>
            <button type="button" className="btn text" onClick={onClose}>
              {COPY.cancel}
            </button>
            <button type="button" className="btn text" onClick={() => setAdvancedOpen(true)}>
              高级设置
            </button>
            <button
              type="button"
              className="btn primary solid"
              disabled={creating || loading}
              onClick={() => void submit()}
            >
              {creating ? "提交中…" : "创建"}
            </button>
          </>
        }
      >
        <div className="create-job-form">
          <FormBlock
            label="刮削路径"
            hint="指定目录时会扫描目录内全部视频文件进行刮削"
          >
            <FolderPicker
              variant="inline"
              pickerTitle="选择刮削路径"
              value={sourcePath}
              onChange={onSourcePathChange}
              usedBy={usedSources}
              currentLabel={currentKind?.label}
              placeholder="选择刮削来源目录"
              onError={(message) => notify("error", message)}
            />
          </FormBlock>

          <FormBlock label="整理目录" hint="刮削整理结果的存放目录">
            <FolderPicker
              variant="inline"
              pickerTitle="选择整理目录"
              value={libraryPath}
              onChange={onLibraryPathChange}
              usedBy={usedLibraries}
              currentLabel={currentKind?.label}
              placeholder="选择整理目标目录"
              onError={(message) => notify("error", message)}
            />
          </FormBlock>

          <FormBlock label="整理模式">
            <select
              className="create-job-control"
              value={organizeMode}
              onChange={(e) => onOrganizeModeChange(e.target.value)}
            >
              {ORGANIZE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {ORGANIZE_MODE_LABELS[mode] ?? mode}
                </option>
              ))}
            </select>
          </FormBlock>

          <FormBlock label="配置复用" hint="从七区监控路径复制刮削目录、整理目录与整理模式">
            <select
              className="create-job-control"
              value={reuseKey}
              onChange={(e) => onReuseChange(e.target.value)}
            >
              <option value="none">不复用</option>
              {reuseKinds.map((kind) => (
                <option key={kind.id} value={kind.id} disabled={!kind.sourceRoot?.trim()}>
                  {KIND_LABELS[kind.id] ?? kind.label}
                  {!kind.sourceRoot?.trim() ? "（未绑定）" : ""}
                </option>
              ))}
            </select>
          </FormBlock>
        </div>
      </Modal>

      <JobAdvancedSettingsModal
        open={advancedOpen}
        value={jobOptions}
        onChange={setJobOptions}
        onClose={() => setAdvancedOpen(false)}
        notify={notify}
        onSavePreset={() => void handleSavePreset()}
        onExportPresets={() => void handleExportPresets()}
        onImportPresets={handleImportPresets}
      />
    </>
  );
}
