export function NamingSyntaxTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="naming-syntax naming-syntax-trigger"
      onClick={onOpen}
    >
      <div className="naming-syntax-top">
        <div className="naming-syntax-title">模板语法</div>
        <span className="naming-syntax-more">查看完整说明</span>
      </div>
      <div className="naming-syntax-chips">
        <code className="naming-chip">{"{number}"}</code>
        <code className="naming-chip">{"{{ number }}"}</code>
        <code className="naming-chip">{"{% if %}"}</code>
        <code className="naming-chip">filter</code>
      </div>
      <p className="naming-syntax-note">
        以下命名规则均支持变量模板。点击展开 Filter、条件判断、实用示例与可用变量。
      </p>
    </button>
  );
}
