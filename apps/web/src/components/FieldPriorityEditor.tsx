const FIELD_LABELS: Record<string, string> = {
  cover: "封面",
  titleZh: "中文标题",
  outline: "简介",
  plot: "剧情简介",
  originalPlot: "原简介",
  studio: "片商",
  actors: "演员",
  tags: "标签",
  series: "系列",
  title: "标题",
  originaltitle: "原标题",
  poster: "海报",
};

type Props = {
  fieldPriority: Record<string, string[]>;
  globalFieldPriority?: Record<string, string[]>;
  disabled?: boolean;
  onChange: (next: Record<string, string[]>) => void;
};

export function FieldPriorityEditor({
  fieldPriority,
  globalFieldPriority,
  disabled,
  onChange,
}: Props) {
  const fields = Object.keys(globalFieldPriority ?? fieldPriority);

  function setList(field: string, raw: string) {
    const sources = raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...fieldPriority, [field]: sources });
  }

  function block(field: string, sourceId: string) {
    const list = fieldPriority[field] ?? globalFieldPriority?.[field] ?? [];
    onChange({
      ...fieldPriority,
      [field]: list.filter((s) => s !== sourceId),
    });
  }

  if (!fields.length) {
    return <p className="set-section-sub">暂无字段优先级配置</p>;
  }

  return (
    <div className="priority-grid">
      {fields.map((field) => {
        const inherited = globalFieldPriority?.[field];
        const own = fieldPriority[field];
        const sources = own?.length ? own : inherited ?? [];
        const displayValue = (own ?? inherited ?? []).join(", ");
        return (
          <div key={field} className="priority-row">
            <span className="priority-field" title={field}>
              {FIELD_LABELS[field] ?? field}
            </span>
            <div className="chip-row">
              {sources.map((s, i) => (
                <button
                  key={`${field}-${s}`}
                  type="button"
                  className="tag sm"
                  title="点击从该字段链中移除"
                  disabled={disabled}
                  onClick={() => block(field, s)}
                >
                  {i + 1}. {s} ×
                </button>
              ))}
            </div>
            <input
              className="priority-edit"
              value={displayValue}
              disabled={disabled}
              onChange={(e) => setList(field, e.target.value)}
              placeholder={inherited?.length ? `继承：${inherited.join(", ")}` : "源 id，逗号分隔"}
            />
          </div>
        );
      })}
      <p className="set-section-sub">
        关闭「使用全局数据源」后编辑；留空继承全局链。点击标签可快速移除源。
      </p>
    </div>
  );
}
