import sharp from "sharp";

/** 横版图（画廊 thumb / ps.jpg） */
export async function isLandscapeImageFile(abs: string): Promise<boolean> {
  try {
    const meta = await sharp(abs).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w <= 0 || h <= 0) return false;
    return w > h * 1.05;
  } catch {
    return false;
  }
}
