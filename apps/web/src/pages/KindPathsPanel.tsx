import { useMemo, useState } from "react";
import { updateKind, type KindRow } from "../api";
import { KindSettingsModal } from "./KindSettingsModal";
import { PanelSkeleton } from "../components/ui/PanelSkeleton";
import { KIND_SHORT_LABELS } from "../lib/labels";
import { displayRelativePath, shortRelativePath } from "../lib/paths";
import type { NotifyFn } from "../lib/notify";

type Props = {
  kinds: KindRow[];
  loading?: boolean;
  onChanged: () => void;
  notify: NotifyFn;
};

function pathPreview(value: string) {
  if (!value) return "未绑定";
  return shortRelativePath(value, 2);
}

export function KindPathsPanel({ kinds, loading, onChanged, notify }: Props) {
  const [activeKindId, setActiveKindId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const kind = kinds.find((k) => k.id === activeKindId) ?? null;

  const usedSources = useMemo(
    () =>
      new Map(
        kinds
          .filter((k) => k.sourceRoot && k.id !== activeKindId)
          .map((k) => [k.sourceRoot, k.label]),
      ),
    [kinds, activeKindId],
  );

  const usedLibraries = useMemo(
    () =>
      new Map(
        kinds
          .filter((k) => k.libraryRoot && k.id !== activeKindId)
          .map((k) => [k.libraryRoot, k.label]),
      ),
    [kinds, activeKindId],
  );

  function openEditor(id: string) {
    setActiveKindId(id);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
  }

  async function toggleEnabled(target: KindRow, enabled: boolean) {
    setTogglingId(target.id);
    try {
      await updateKind(target.id, {
        enabled,
        label: target.label,
        sourceRoot: target.sourceRoot,
        libraryRoot: target.libraryRoot,
      });
      notify("ok", `「${target.label}」已${enabled ? "启用" : "停用"}`);
      onChanged();
    } catch (e) {
      notify("error", e, "更新分区状态失败");
    } finally {
      setTogglingId(null);
    }
  }

  if (loading && !kinds.length) {
    return <PanelSkeleton label="加载分区配置…" lines={6} />;
  }

  if (!kinds.length) {
    return <div className="empty-block">暂无分区配置</div>;
  }

  return (
    <section className={`mon-panel${loading ? " is-refreshing" : ""}`}>
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">七区监控</h3>
      </header>

      <div className="mon-panel-body mon-panel-body--pad">
        <div className="kind-cfg-list">
          {kinds.map((k) => {
            const toggling = togglingId === k.id;
            return (
              <div
                key={k.id}
                className={`kind-cfg-item${k.enabled ? " is-on" : " is-off"}`}
                role="button"
                tabIndex={0}
                onClick={() => openEditor(k.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditor(k.id);
                  }
                }}
              >
                <div className="kind-cfg-item-main">
                  <span className="kind-cfg-item-name">
                    {KIND_SHORT_LABELS[k.id] ?? k.label}
                  </span>
                  <label
                    className="switch kind-cfg-enable"
                    title={k.enabled ? "停用监控" : "启用监控"}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={k.enabled}
                      disabled={toggling || loading}
                      onChange={(e) => void toggleEnabled(k, e.target.checked)}
                    />
                    <span />
                  </label>
                </div>
                <div className="kind-cfg-item-paths">
                  <div className={`kind-cfg-path${!k.sourceRoot ? " empty" : ""}`}>
                    <em>来源</em>
                    <span title={displayRelativePath(k.sourceRoot)}>{pathPreview(k.sourceRoot)}</span>
                  </div>
                  <div className={`kind-cfg-path${!k.libraryRoot ? " empty" : ""}`}>
                    <em>输出</em>
                    <span title={displayRelativePath(k.libraryRoot)}>{pathPreview(k.libraryRoot)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <KindSettingsModal
        open={editorOpen && !!kind}
        kind={kind}
        usedSources={usedSources}
        usedLibraries={usedLibraries}
        notify={notify}
        onClose={closeEditor}
        onSaved={onChanged}
      />
    </section>
  );
}
