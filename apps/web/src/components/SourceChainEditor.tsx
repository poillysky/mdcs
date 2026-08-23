import { useState } from "react";
import type { ProviderCatalogRow } from "../types";

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  catalog: ProviderCatalogRow[];
  disabled?: boolean;
  emptyText?: string;
};

export function SourceChainEditor({
  values,
  onChange,
  catalog,
  disabled,
  emptyText = "暂无源，请添加",
}: Props) {
  const [pick, setPick] = useState("");

  const labelOf = (id: string) => catalog.find((c) => c.id === id)?.label ?? id;

  const available = catalog.filter((c) => c.enabled !== false && !values.includes(c.id));

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= values.length) return;
    const copy = [...values];
    const tmp = copy[index]!;
    copy[index] = copy[next]!;
    copy[next] = tmp;
    onChange(copy);
  }

  function remove(id: string) {
    onChange(values.filter((x) => x !== id));
  }

  function add() {
    const id = pick.trim();
    if (!id || values.includes(id)) return;
    onChange([...values, id]);
    setPick("");
  }

  return (
    <div className={`org-tags source-chain${disabled ? " disabled" : ""}`}>
      <div className="chip-grid org-tags-list source-chain-list">
        {values.length ? (
          values.map((id, i) => (
            <div key={id} className="source-chain-item">
              {!disabled ? (
                <span className="source-chain-move">
                  <button
                    type="button"
                    className="source-chain-btn"
                    disabled={i === 0}
                    aria-label="上移"
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="source-chain-btn"
                    disabled={i === values.length - 1}
                    aria-label="下移"
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
              <span className="chip active source-chain-chip" title={id}>
                <em>{i + 1}</em>
                {labelOf(id)}
                {!disabled ? (
                  <button
                    type="button"
                    className="source-chain-x"
                    aria-label={`移除 ${labelOf(id)}`}
                    onClick={() => remove(id)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            </div>
          ))
        ) : (
          <span className="org-tags-empty">{emptyText}</span>
        )}
      </div>
      {!disabled ? (
        <div className="org-tags-add">
          <select
            className="org-select"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="选择刮削源"
          >
            <option value="">选择 Provider…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.id})
              </option>
            ))}
          </select>
          <button type="button" className="btn sm" disabled={!pick} onClick={add}>
            添加
          </button>
        </div>
      ) : null}
    </div>
  );
}
