import type { Wm } from "./types";
import { ChipToggle, Section } from "./widgets";

export function WatermarkApplySection({
  w,
  patch,
}: {
  w: Wm;
  patch: (partial: Partial<Wm>) => void;
}) {
  return (
    <Section title="图片类型">
      <div className="wm-chip-row">
        <ChipToggle
          checked={Boolean(w.applyPoster)}
          label="封面图"
          tone="poster"
          onChange={(v) => patch({ applyPoster: v })}
        />
        <ChipToggle
          checked={Boolean(w.applyThumb)}
          label="缩略图"
          tone="thumb"
          onChange={(v) => patch({ applyThumb: v })}
        />
        <ChipToggle
          checked={Boolean(w.applyFanart)}
          label="背景图"
          tone="fanart"
          onChange={(v) => patch({ applyFanart: v })}
        />
      </div>
    </Section>
  );
}

export function WatermarkMarkTypesSection({
  w,
  patch,
}: {
  w: Wm;
  patch: (partial: Partial<Wm>) => void;
}) {
  return (
    <Section title="水印类型">
      <p className="wm-section-hint">有码 / 无码 / 流出 / 破解逐级覆盖</p>
      <div className="wm-chip-row">
        <ChipToggle
          checked={Boolean(w.markSubtitle)}
          label="字幕"
          tone="sub"
          onChange={(v) => patch({ markSubtitle: v })}
        />
        <ChipToggle
          checked={Boolean(w.markCracked)}
          label="破解"
          tone="cracked"
          onChange={(v) => patch({ markCracked: v })}
        />
        <ChipToggle
          checked={Boolean(w.markLeak)}
          label="流出"
          tone="leak"
          onChange={(v) => patch({ markLeak: v })}
        />
        <ChipToggle
          checked={Boolean(w.markUncensored)}
          label="无码"
          tone="wuma"
          onChange={(v) => patch({ markUncensored: v })}
        />
        <ChipToggle
          checked={Boolean(w.markCensored)}
          label="有码"
          tone="youma"
          onChange={(v) => patch({ markCensored: v })}
        />
        <ChipToggle
          checked={Boolean(w.markResolution)}
          label="4K/8K"
          tone="res"
          onChange={(v) => patch({ markResolution: v })}
        />
      </div>
    </Section>
  );
}
