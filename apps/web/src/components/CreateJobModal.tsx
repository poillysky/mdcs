import { useEffect, useState } from "react";
import {
  createJob,
  deletePreset,
  exportPresets,
  fetchOpsConfig,
  importPresets,
  savePreset,
  type KindRow,
} from "../api";
import { JobAdvancedSettingsModal } from "./JobAdvancedSettingsModal";
import { Modal } from "./Modal";
import { JOB_MODE_LABELS } from "../lib/labels";
import { defaultJobOptions, type JobOptions } from "../lib/jobOptions";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { JobPreset, OpsConfig } from "../types";

const MODES = ["scan_only", "scrape_only", "full", "organize_only", "rescan"] as const;

type ReuseMode = "none" | "last" | "preset";

type Props = {
  open: boolean;
  kinds: KindRow[];
  loading: boolean;
  defaultMode?: string;
  defaultKindIds?: string[];
  onClose: () => void;
  onCreated: () => void;
  notify: NotifyFn;
};

function applySnapshot(
  snap: { kinds: string[]; mode: string; dryRun: boolean; options: Record<string, unknown> },
  setters: {
    setMode: (m: string) => void;
    setSelected: (s: Set<string>) => void;
    setDryRun: (v: boolean) => void;
    setJobOptions: (o: JobOptions) => void;
  },
) {
  setters.setMode(snap.mode || "scan_only");
  setters.setSelected(new Set(snap.kinds?.length ? snap.kinds : ["*enabled"]));
  setters.setDryRun(Boolean(snap.dryRun));
  const opts = snap.options && typeof snap.options === "object" ? snap.options : {};
  setters.setJobOptions({ ...defaultJobOptions(), ...(opts as JobOptions) });
}

export function CreateJobModal({
  open,
  kinds,
  loading,
  defaultMode,
  defaultKindIds,
  onClose,
  onCreated,
  notify,
}: Props) {
  const [mode, setMode] = useState<string>("scan_only");
  const [selected, setSelected] = useState<Set<string>>(new Set(["*enabled"]));
  const [dryRun, setDryRun] = useState(false);
  const [creating, setCreating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jobOptions, setJobOptions] = useState<JobOptions>(defaultJobOptions());
  const [reuse, setReuse] = useState<ReuseMode>("none");
  const [presetId, setPresetId] = useState("");
  const [ops, setOps] = useState<OpsConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode ?? "scan_only");
    setSelected(defaultKindIds?.length ? new Set(defaultKindIds) : new Set(["*enabled"]));
    setDryRun(false);
    setJobOptions(defaultJobOptions());
    setAdvancedOpen(false);
    setReuse("none");
    setPresetId("");
    void (async () => {
      try {
        const data = await fetchOpsConfig();
        setOps(data.config);
      } catch {
        setOps(null);
      }
    })();
  }, [open, defaultMode, defaultKindIds]);

  const allEnabled = selected.has("*enabled");
  const presets = ops?.presets ?? [];
  const lastJob = ops?.lastJob;

  function toggleKind(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete("*enabled");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!next.size) next.add("*enabled");
      return next;
    });
  }

  function selectAllEnabled() {
    setSelected(new Set(["*enabled"]));
  }

  function onReuseChange(next: ReuseMode) {
    setReuse(next);
    if (next === "none") return;
    if (next === "last" && lastJob) {
      applySnapshot(lastJob, { setMode, setSelected, setDryRun, setJobOptions });
      return;
    }
    if (next === "preset") {
      const p = presets.find((x) => x.id === presetId) || presets[0];
      if (p) {
        setPresetId(p.id);
        applySnapshot(p, { setMode, setSelected, setDryRun, setJobOptions });
      }
    }
  }

  function onPresetPick(id: string) {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (p) applySnapshot(p, { setMode, setSelected, setDryRun, setJobOptions });
  }

  async function submit() {
    const needsOrganize = mode === "full" || mode === "organize_only";
    const overrideMove =
      jobOptions.useGlobal?.organize === false && jobOptions.organize?.organizeMode === "move";
    const anyKindMove = kinds.some((k) => k.enabled && k.organizeMode === "move");
    const willMove =
      needsOrganize &&
      (overrideMove || (jobOptions.useGlobal?.organize !== false && anyKindMove));
    if (willMove && !dryRun) {
      const ok = window.confirm(
        "当前任务将使用「移动」整理：源文件会从 inbox 删除。确定继续？",
      );
      if (!ok) return;
    }

    setCreating(true);
    try {
      const kindsArg = allEnabled ? ["*enabled"] : [...selected];
      const hasOverrides = Object.values(jobOptions.useGlobal ?? {}).some((v) => v === false);
      await createJob({
        kinds: kindsArg,
        mode,
        dryRun,
        options: hasOverrides ? jobOptions : undefined,
      });
      notify("ok", `已提交「${JOB_MODE_LABELS[mode] ?? mode}」任务`);
      onCreated();
      onClose();
    } catch (e) {
      notify("error", e, "提交失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleSavePreset() {
    const name = window.prompt("预设名称", presets.find((p) => p.id === presetId)?.name || "");
    if (!name?.trim()) return;
    try {
      const kindsArg = allEnabled ? ["*enabled"] : [...selected];
      const hasOverrides = Object.values(jobOptions.useGlobal ?? {}).some((v) => v === false);
      const { config } = await savePreset({
        id: presetId || undefined,
        name: name.trim(),
        kinds: kindsArg,
        mode,
        dryRun,
        options: (hasOverrides ? jobOptions : {}) as Record<string, unknown>,
      });
      setOps(config);
      notify("ok", "预设已保存");
    } catch (e) {
      notify("error", e, "保存预设失败");
    }
  }

  async function handleExport() {
    try {
      const data = await exportPresets();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scrap-presets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("ok", `已导出 ${data.presets.length} 条预设`);
    } catch (e) {
      notify("error", e, "导出失败");
    }
  }

  async function handleImport() {
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
              presets?: JobPreset[];
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

  async function handleDeletePreset() {
    if (!presetId) return;
    if (!window.confirm("删除当前选中的预设？")) return;
    try {
      const { config } = await deletePreset(presetId);
      setOps(config);
      setPresetId("");
      setReuse("none");
      notify("ok", "预设已删除");
    } catch (e) {
      notify("error", e, "删除失败");
    }
  }

  return (
    <>
      <Modal
        open={open}
        title="创建任务"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={onClose}>
              {COPY.cancel}
            </button>
            <button type="button" className="btn" onClick={() => setAdvancedOpen(true)}>
              高级设置
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={creating || loading}
              onClick={() => void submit()}
            >
              {creating ? "提交中…" : COPY.createTask}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="span-2 field">
            <span>配置复用</span>
            <select
              value={reuse}
              onChange={(e) => onReuseChange(e.target.value as ReuseMode)}
            >
              <option value="none">不复用</option>
              <option value="last" disabled={!lastJob}>
                复用上次{lastJob ? "" : "（尚无记录）"}
              </option>
              <option value="preset" disabled={!presets.length}>
                复用预设{presets.length ? "" : "（暂无预设）"}
              </option>
            </select>
          </label>

          {reuse === "preset" ? (
            <label className="span-2 field">
              <span>选择预设</span>
              <select value={presetId} onChange={(e) => onPresetPick(e.target.value)}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="span-2 field">
            <span>任务模式</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {JOB_MODE_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </label>

          <div className="span-2 field">
            <span>目标分区</span>
            <button type="button" className="btn sm ghost" onClick={selectAllEnabled}>
              全部启用分区
            </button>
            <div className="chip-grid">
              {kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`chip${!allEnabled && selected.has(k.id) ? " active" : ""}${allEnabled ? " dim" : ""}`}
                  disabled={!k.enabled}
                  onClick={() => toggleKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {allEnabled ? (
              <p className="hint">将作用于所有已启用分区</p>
            ) : (
              <p className="hint">已选 {selected.size} 个分区</p>
            )}
          </div>

          <label className="span-2 switch block">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span>试运行（dry-run，不写入文件）</span>
          </label>

          <div className="span-2 toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn sm" onClick={() => void handleSavePreset()}>
              保存为预设
            </button>
            <button type="button" className="btn sm ghost" onClick={() => void handleExport()}>
              导出预设
            </button>
            <button type="button" className="btn sm ghost" onClick={() => void handleImport()}>
              导入预设
            </button>
            {reuse === "preset" && presetId ? (
              <button type="button" className="btn sm ghost" onClick={() => void handleDeletePreset()}>
                删除预设
              </button>
            ) : null}
          </div>
        </div>
      </Modal>

      <JobAdvancedSettingsModal
        open={advancedOpen}
        value={jobOptions}
        onChange={setJobOptions}
        onClose={() => setAdvancedOpen(false)}
      />
    </>
  );
}
