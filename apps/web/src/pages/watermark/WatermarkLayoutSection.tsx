import { SettingRow } from "../../components/SettingRow";
import { CORNER_OPTS, type Corner, type Wm } from "./types";
import { Section } from "./widgets";

export function WatermarkLayoutSection({
  w,
  patch,
}: {
  w: Wm;
  patch: (partial: Partial<Wm>) => void;
}) {
  return (
    <Section title="布局与几何">
      <SettingRow label="布局方式" hint="堆叠横向添加；顺/逆时针在四角依次添加">
        <select
          className="org-select"
          value={w.layout}
          onChange={(e) => patch({ layout: e.target.value as Wm["layout"] })}
        >
          <option value="stack">堆叠</option>
          <option value="clockwise">顺时针</option>
          <option value="counterclockwise">逆时针</option>
        </select>
      </SettingRow>
      <SettingRow label="起始位置" hint="第一个水印的添加位置">
        <select
          className="org-select"
          value={w.startPosition}
          onChange={(e) => patch({ startPosition: e.target.value as Corner })}
        >
          {CORNER_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="缩放倍率" hint="相对海报高度的水印缩放比例">
        <input
          className="org-input org-input-sm"
          type="number"
          min={2}
          max={40}
          value={w.heightRatio}
          onChange={(e) => patch({ heightRatio: Number(e.target.value) || 9 })}
        />
      </SettingRow>
      <SettingRow label="横向偏移" hint="水印相对边缘的水平偏移">
        <input
          className="org-input org-input-sm"
          type="number"
          min={0}
          value={w.offsetX}
          onChange={(e) => patch({ offsetX: Number(e.target.value) || 0 })}
        />
      </SettingRow>
      <SettingRow label="纵向偏移" hint="水印相对边缘的垂直偏移">
        <input
          className="org-input org-input-sm"
          type="number"
          min={0}
          value={w.offsetY}
          onChange={(e) => patch({ offsetY: Number(e.target.value) || 0 })}
        />
      </SettingRow>
      <SettingRow label="间距" hint="同角多个水印之间的间距">
        <input
          className="org-input org-input-sm"
          type="number"
          min={0}
          value={w.spacing}
          onChange={(e) => patch({ spacing: Number(e.target.value) || 0 })}
        />
      </SettingRow>
    </Section>
  );
}
