type Props = {
  label?: string;
  lines?: number;
  className?: string;
};

export function PanelSkeleton({
  label,
  lines = 5,
  className = "panel-skeleton",
}: Props) {
  return (
    <div className={className} aria-busy="true" aria-label={label ?? "加载中"}>
      {label ? <p className="panel-skeleton-label">{label}</p> : null}
      <div className="panel-skeleton-body">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="panel-skeleton-line"
            style={{ width: i % 3 === 0 ? "100%" : i % 3 === 1 ? "82%" : "64%" }}
          >
            <span className="ui-skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
