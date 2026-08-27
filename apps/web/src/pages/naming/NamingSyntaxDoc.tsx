export const SYNTAX_FILTERS: { code: string; desc: string }[] = [
  { code: '{{ studio | default("独立") }}', desc: "缺失时使用默认值" },
  { code: "{{ number | upper }}", desc: "转大写" },
  { code: "{{ number | lower }}", desc: "转小写" },
  { code: "{{ title | truncate(20) }}", desc: "截断超长文本" },
  { code: '{{ number | split("-") | first }}', desc: "拆分取首段" },
  { code: '{{ number | split("-") | last }}', desc: "拆分取末段" },
  { code: '{{ title | replace("A", "B") }}', desc: "替换文本" },
  { code: '{{ " text " | trim }}', desc: "去除首尾空格" },
];

export const SYNTAX_CONDS: { code: string; desc: string }[] = [
  { code: "{% if series %}{{ series }}/{% endif %}", desc: "有值时才显示" },
  {
    code: "{% if director %}{{ director }}{% else %}未知{% endif %}",
    desc: "有值/无值分别处理",
  },
];

export const SYNTAX_EXAMPLES: { code: string; desc: string }[] = [
  {
    code: "{{ number }}{% if publish_number %} ({{ publish_number }}){% endif %}",
    desc: "有发行号时附加括号",
  },
  {
    code: '{{ actor | default(studio | default("未知")) }}',
    desc: "多级降级：演员 → 制片方 → 固定值",
  },
  {
    code: '{{ category }}/{{ number | split("-") | first }}/{{ number }}',
    desc: "按分类和番号前缀归档",
  },
];

export const SYNTAX_VARS: { name: string; desc: string }[] = [
  { name: "number", desc: "番号（如 ABS-001）" },
  { name: "publish_number", desc: "发行号（如 118abs001）" },
  { name: "series_name", desc: "番号前缀（如 ABS）" },
  { name: "serial_number", desc: "番号后缀（如 001）" },
  { name: "first_letter", desc: "番号前缀首字母（如 A）" },
  { name: "series", desc: "系列" },
  { name: "category", desc: "分类" },
  { name: "actor", desc: "演员" },
  { name: "first_actor", desc: "首位演员" },
  { name: "title", desc: "标题" },
  { name: "originaltitle", desc: "原标题" },
  { name: "year", desc: "发布年份" },
  { name: "director", desc: "导演" },
  { name: "studio", desc: "制片方" },
  { name: "publisher", desc: "发行方" },
  { name: "runtime", desc: "时长（分钟）" },
  { name: "release", desc: "发布日期" },
  { name: "source_filename", desc: "源文件名（不含扩展名）" },
  { name: "filename", desc: "源文件名别名（等同 source_filename）" },
  { name: "source_path", desc: "源文件完整路径" },
  { name: "subtitle", desc: "中文字幕标识" },
  { name: "mosaic", desc: "有码/无码标识" },
  { name: "resolution", desc: "分辨率" },
];

export function NamingSyntaxDoc() {
  return (
    <div className="naming-doc">
      <div className="naming-doc-intro">
        <p>以下命名规则均支持变量模板。</p>
        <div className="naming-doc-pair">
          <div className="naming-doc-pair-card">
            <span className="naming-doc-kicker">基础</span>
            <code>{"{number}"}</code>
            <span>缺失 →「未知」</span>
          </div>
          <div className="naming-doc-pair-card">
            <span className="naming-doc-kicker">Jinja2</span>
            <code>{"{{ number }}"}</code>
            <span>缺失 → 空；支持条件 / filter</span>
          </div>
        </div>
      </div>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">常用 Filter</h4>
        <div className="naming-doc-table">
          {SYNTAX_FILTERS.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">条件判断</h4>
        <div className="naming-doc-table naming-doc-table--stack">
          {SYNTAX_CONDS.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">实用模板示例</h4>
        <div className="naming-doc-table naming-doc-table--stack">
          {SYNTAX_EXAMPLES.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">AI 辅助生成</h4>
        <div className="naming-doc-ai">
          <p>
            配置 LLM 后，输入框右侧会出现 <strong>✦</strong>
            。先清空输入框，写入自然语言描述，再点 ✦，将读取输入框内容并生成 Jinja2
            模板（可与基础 {"{field}"} 混写）。
          </p>
          <p className="naming-doc-ai-ex">
            例：按分类、演员分目录，但分类包含 FC2 和素人时不需要演员目录
          </p>
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">可用变量</h4>
        <div className="naming-doc-vars">
          {SYNTAX_VARS.map((v) => (
            <div key={v.name} className="naming-doc-var">
              <code>{v.name}</code>
              <span>{v.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
