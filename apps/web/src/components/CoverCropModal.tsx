import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Circle, CircleDot, Square, SquareCheck } from "lucide-react";
import {
  fetchCoverCropSource,
  submitCoverCrop,
  type CoverCropMarks,
  type CoverCropSourceInfo,
  type CoverCropStyle,
} from "../api";
import { CoverCropImagePicker } from "./CoverCropImagePicker";
import { Modal } from "./Modal";
import { displayRelativePath } from "../lib/paths";
import type { FileRow } from "../types";

type CropRect = { left: number; top: number; width: number; height: number };

type Props = {
  open: boolean;
  file: FileRow;
  onClose: () => void;
  onDone?: (updatedAt: number) => void;
};

function cropRatioForStyle(style: CoverCropStyle): number {
  if (style === "emby") return 2 / 3;
  if (style === "horizontal") return 16 / 9;
  return 2.12 / 3;
}

function defaultCropRect(width: number, height: number, style: CoverCropStyle): CropRect {
  const ratio = cropRatioForStyle(style);
  let cw: number;
  let ch: number;
  if (width / height >= ratio) {
    ch = height;
    cw = Math.floor(height * ratio);
  } else {
    cw = width;
    ch = Math.floor(width / ratio);
  }
  cw = Math.max(1, Math.min(cw, width));
  ch = Math.max(1, Math.min(ch, height));
  const left =
    style === "horizontal"
      ? Math.max(0, Math.floor((width - cw) / 2))
      : Math.max(0, width - cw);
  const top = Math.max(0, Math.floor((height - ch) / 2));
  return { left, top, width: cw, height: ch };
}

function clampRect(rect: CropRect, maxW: number, maxH: number): CropRect {
  const w = Math.max(1, Math.min(Math.round(rect.width), maxW));
  const h = Math.max(1, Math.min(Math.round(rect.height), maxH));
  return {
    left: Math.max(0, Math.min(Math.round(rect.left), maxW - w)),
    top: Math.max(0, Math.min(Math.round(rect.top), maxH - h)),
    width: w,
    height: h,
  };
}

const CROP_OPTION_ICON = { size: 16, strokeWidth: 2, "aria-hidden": true as const };

function CropRadioIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <CircleDot {...CROP_OPTION_ICON} className="cover-crop-option-icon is-checked" />
  ) : (
    <Circle {...CROP_OPTION_ICON} className="cover-crop-option-icon" />
  );
}

function CropCheckIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <SquareCheck {...CROP_OPTION_ICON} className="cover-crop-option-icon is-checked" />
  ) : (
    <Square {...CROP_OPTION_ICON} className="cover-crop-option-icon" />
  );
}

function CropRadioOption({
  name,
  checked,
  onChange,
  label,
  inline,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  inline?: boolean;
}) {
  return (
    <label className={`cover-crop-option${inline ? " cover-crop-option-inline" : ""}`}>
      <span className="cover-crop-option-mark">
        <input type="radio" name={name} checked={checked} onChange={onChange} />
        <CropRadioIcon checked={checked} />
      </span>
      <span className="cover-crop-option-label">{label}</span>
    </label>
  );
}

function CropCheckOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="cover-crop-option cover-crop-option-check">
      <span className="cover-crop-option-mark">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <CropCheckIcon checked={checked} />
      </span>
      <span className="cover-crop-option-label">{label}</span>
    </label>
  );
}

export function CoverCropModal({ open, file, onClose, onDone }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; rect: CropRect } | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<CoverCropSourceInfo | null>(null);
  const [customSource, setCustomSource] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropStyle, setCropStyle] = useState<CoverCropStyle>("full");
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [displayBox, setDisplayBox] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const [replaceThumb, setReplaceThumb] = useState(false);
  const [marks, setMarks] = useState<CoverCropMarks>({
    subtitle: false,
    mosaic: "none",
    cracked: false,
    resolution: "none",
  });

  const previewUrl = useMemo(() => {
    if (!source?.previewUrl) return "";
    const sep = source.previewUrl.includes("?") ? "&" : "?";
    return `${source.previewUrl}${sep}t=${Date.now()}`;
  }, [source?.previewUrl]);

  const loadSource = useCallback(
    async (opts?: { source?: string }) => {
      setLoading(true);
      setError("");
      try {
        const info = await fetchCoverCropSource(file.id, {
          source: opts?.source || "local",
        });
        setSource(info);
        setCropRect(defaultCropRect(info.width, info.height, "full"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载原图失败");
        setSource(null);
      } finally {
        setLoading(false);
      }
    },
    [file.id],
  );

  useEffect(() => {
    if (!open) return;
    setCustomSource(undefined);
    setPickerOpen(false);
    setCropStyle("full");
    setReplaceThumb(false);
    setMarks({ subtitle: false, mosaic: "none", cracked: false, resolution: "none" });
    void loadSource();
  }, [open, file.id, loadSource]);

  useEffect(() => {
    if (!source) return;
    setCropRect(defaultCropRect(source.width, source.height, cropStyle));
  }, [cropStyle, source?.width, source?.height]);

  const updateDisplayBox = useCallback(() => {
    const el = previewRef.current;
    if (!el || !source) return;
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / source.width, rect.height / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    setDisplayBox({
      width: dw,
      height: dh,
      offsetX: (rect.width - dw) / 2,
      offsetY: (rect.height - dh) / 2,
    });
  }, [source]);

  useEffect(() => {
    if (!open || !source) return;
    updateDisplayBox();
    const ro = new ResizeObserver(updateDisplayBox);
    if (previewRef.current) ro.observe(previewRef.current);
    return () => ro.disconnect();
  }, [open, source, updateDisplayBox]);

  const imageScale = source && displayBox.width > 0 ? displayBox.width / source.width : 1;

  const cropDisplay = useMemo(() => {
    if (!cropRect || !source || imageScale <= 0 || displayBox.width <= 0) return null;
    return {
      left: cropRect.left * imageScale,
      top: cropRect.top * imageScale,
      width: cropRect.width * imageScale,
      height: cropRect.height * imageScale,
      frameW: displayBox.width,
      frameH: displayBox.height,
    };
  }, [cropRect, source, imageScale, displayBox.width, displayBox.height]);

  const frameStyle = useMemo(() => {
    if (displayBox.width <= 0) return undefined;
    return {
      left: `${displayBox.offsetX}px`,
      top: `${displayBox.offsetY}px`,
      width: `${displayBox.width}px`,
      height: `${displayBox.height}px`,
    };
  }, [displayBox]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cropRect) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, rect: { ...cropRect } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !source) return;
    const dx = (e.clientX - drag.startX) / imageScale;
    const dy = (e.clientY - drag.startY) / imageScale;
    setCropRect(
      clampRect(
        {
          ...drag.rect,
          left: drag.rect.left + dx,
          top: drag.rect.top + dy,
        },
        source.width,
        source.height,
      ),
    );
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPickPath = (relativePath: string) => {
    setCustomSource(relativePath);
    void loadSource({ source: relativePath });
  };

  const onSubmit = async () => {
    if (!source || !cropRect) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitCoverCrop(file.id, {
        source: customSource || "local",
        cropStyle,
        cropRect,
        marks,
        replaceThumb,
      });
      onDone?.(result.updatedAt);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      title="封面裁剪"
      variant="sheet"
      wide
      className="modal-cover-crop"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="cover-crop-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            className="cover-crop-submit"
            onClick={() => void onSubmit()}
            disabled={submitting || loading || !source || !cropRect}
          >
            {submitting ? "提交中…" : "提交"}
          </button>
        </>
      }
    >
      <div className="cover-crop-modal">
        <div className="cover-crop-source-row">
          <label className="cover-crop-label">原图来源</label>
          <div className="cover-crop-path-wrap">
            <input
              className="cover-crop-path"
              readOnly
              value={source?.path ? displayRelativePath(source.path) : ""}
              placeholder={loading ? "加载中…" : "—"}
            />
            <span className="cover-crop-path-badge" aria-hidden>
              {customSource ? "手动" : "本地"}
            </span>
          </div>
          <button
            type="button"
            className="cover-crop-pick-link"
            onClick={() => setPickerOpen(true)}
            disabled={loading || submitting}
          >
            手动选择
          </button>
        </div>

        <div className="cover-crop-main">
          <div className="cover-crop-preview" ref={previewRef}>
            {previewUrl && frameStyle ? (
              <div className="cover-crop-image-frame" style={frameStyle}>
                <img src={previewUrl} alt="" className="cover-crop-preview-img" draggable={false} />
                {cropDisplay ? (
                  <>
                    <div
                      className="cover-crop-dim cover-crop-dim-top"
                      style={{ height: cropDisplay.top }}
                    />
                    <div
                      className="cover-crop-dim cover-crop-dim-bottom"
                      style={{
                        top: cropDisplay.top + cropDisplay.height,
                        height: Math.max(0, cropDisplay.frameH - cropDisplay.top - cropDisplay.height),
                      }}
                    />
                    <div
                      className="cover-crop-dim cover-crop-dim-left"
                      style={{
                        top: cropDisplay.top,
                        width: cropDisplay.left,
                        height: cropDisplay.height,
                      }}
                    />
                    <div
                      className="cover-crop-dim cover-crop-dim-right"
                      style={{
                        top: cropDisplay.top,
                        left: cropDisplay.left + cropDisplay.width,
                        width: Math.max(0, cropDisplay.frameW - cropDisplay.left - cropDisplay.width),
                        height: cropDisplay.height,
                      }}
                    />
                    <div
                      className="cover-crop-selection"
                      style={{
                        left: cropDisplay.left,
                        top: cropDisplay.top,
                        width: cropDisplay.width,
                        height: cropDisplay.height,
                      }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
            {loading ? <div className="cover-crop-loading">加载中…</div> : null}
          </div>

          <aside className="cover-crop-side">
            <section className="cover-crop-section">
              <h3 className="cover-crop-section-title">裁剪方式</h3>
              <div className="cover-crop-option-list">
                <CropRadioOption
                  name="cropStyle"
                  checked={cropStyle === "full"}
                  onChange={() => setCropStyle("full")}
                  label="纵向(完整海报尺寸)"
                />
                <CropRadioOption
                  name="cropStyle"
                  checked={cropStyle === "emby"}
                  onChange={() => setCropStyle("emby")}
                  label="纵向(Emby海报尺寸)"
                />
                <CropRadioOption
                  name="cropStyle"
                  checked={cropStyle === "horizontal"}
                  onChange={() => setCropStyle("horizontal")}
                  label="横向"
                />
              </div>
            </section>

            <section className="cover-crop-section">
              <h3 className="cover-crop-section-title">添加水印</h3>
              <CropCheckOption
                checked={Boolean(marks.subtitle)}
                onChange={(subtitle) => setMarks((m) => ({ ...m, subtitle }))}
                label="字幕"
              />
              <div className="cover-crop-option-row">
                {(
                  [
                    ["none", "无"],
                    ["censored", "有码"],
                    ["uncensored", "无码"],
                    ["leak", "流出"],
                  ] as const
                ).map(([id, label]) => (
                  <CropRadioOption
                    key={id}
                    name="mosaic"
                    inline
                    checked={marks.mosaic === id}
                    onChange={() => setMarks((m) => ({ ...m, mosaic: id }))}
                    label={label}
                  />
                ))}
              </div>
              <div className="cover-crop-option-row">
                <CropRadioOption
                  name="cracked"
                  inline
                  checked={Boolean(marks.cracked)}
                  onChange={() => setMarks((m) => ({ ...m, cracked: true }))}
                  label="破解"
                />
                <CropRadioOption
                  name="cracked"
                  inline
                  checked={!marks.cracked}
                  onChange={() => setMarks((m) => ({ ...m, cracked: false }))}
                  label="无"
                />
              </div>
              <div className="cover-crop-option-row">
                {(
                  [
                    ["4K", "4K"],
                    ["8K", "8K"],
                    ["none", "无"],
                  ] as const
                ).map(([id, label]) => (
                  <CropRadioOption
                    key={id}
                    name="resolution"
                    inline
                    checked={marks.resolution === id}
                    onChange={() => setMarks((m) => ({ ...m, resolution: id }))}
                    label={label}
                  />
                ))}
              </div>
            </section>

            <section className="cover-crop-section">
              <h3 className="cover-crop-section-title">处理选项</h3>
              <CropCheckOption
                checked={replaceThumb}
                onChange={setReplaceThumb}
                label="同时替换缩略图"
              />
            </section>
          </aside>
        </div>

        {error ? <p className="cover-crop-error">{error}</p> : null}
      </div>
    </Modal>

      <CoverCropImagePicker
        open={pickerOpen}
        fileId={file.id}
        initialPath={customSource || source?.path || ""}
        onClose={() => setPickerOpen(false)}
        onPick={onPickPath}
        onError={(message) => setError(message)}
      />
    </>
  );
}
