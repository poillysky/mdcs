import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export type FaceBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  score: number;
};

export type CropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

let netsReady: Promise<boolean> | null = null;

function modelDir(): string {
  const require = createRequire(import.meta.url);
  const pkg = path.dirname(require.resolve("@vladmandic/face-api/package.json"));
  return path.join(pkg, "model");
}

async function ensureFaceNets(): Promise<boolean> {
  if (!netsReady) {
    netsReady = (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        // 纯 JS CPU，避免依赖原生 tfjs-node
        await tf.setBackend("cpu");
        await tf.ready();
        const faceapi = await import("@vladmandic/face-api");
        const dir = modelDir();
        if (!fs.existsSync(path.join(dir, "tiny_face_detector_model.bin"))) {
          return false;
        }
        await faceapi.nets.tinyFaceDetector.loadFromDisk(dir);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return netsReady;
}

/** 从多个人脸中选主体：分数 + 面积 + 略偏右（封面人物常见） */
export function selectPrimaryFace(faces: FaceBox[], imageWidth: number): FaceBox | null {
  if (!faces.length) return null;
  return faces.reduce((best, face) => {
    const scoreOf = (f: FaceBox) => {
      const cx = f.left + f.width / 2;
      const rightBias = imageWidth > 0 ? cx / imageWidth : 0;
      const area = f.width * f.height;
      return f.score * 100 + rightBias * 12 + Math.min(area / 1000, 30);
    };
    return scoreOf(face) > scoreOf(best) ? face : best;
  });
}

/**
 * 以人脸为锚点生成目标比例竖裁框。
 * 人脸中心略偏上（约 38% 高度处），并保证脸在框内留边。
 */
export function faceFocusBox(
  imageWidth: number,
  imageHeight: number,
  face: FaceBox,
  ratio: number,
): CropRect {
  let cw = imageWidth;
  let ch = imageHeight;
  if (imageWidth / imageHeight > ratio) cw = Math.floor(imageHeight * ratio);
  else ch = Math.floor(imageWidth / ratio);
  cw = Math.max(1, Math.min(cw, imageWidth));
  ch = Math.max(1, Math.min(ch, imageHeight));

  const faceCx = face.left + face.width / 2;
  const faceCy = face.top + face.height / 2;
  // 脸放在框偏上位置
  let left = Math.round(faceCx - cw / 2);
  let top = Math.round(faceCy - ch * 0.38);

  const pad = Math.max(Math.round(Math.max(face.width, face.height) * 0.35), 8);
  const minLeft = Math.max(0, face.left + face.width + pad - cw);
  const maxLeft = Math.min(imageWidth - cw, face.left - pad);
  if (minLeft <= maxLeft) {
    left = Math.max(minLeft, Math.min(left, maxLeft));
  } else {
    left = Math.max(0, Math.min(left, imageWidth - cw));
  }

  const minTop = Math.max(0, face.top + face.height + pad - ch);
  const maxTop = Math.min(imageHeight - ch, face.top - pad);
  if (minTop <= maxTop) {
    top = Math.max(minTop, Math.min(top, maxTop));
  } else {
    top = Math.max(0, Math.min(top, imageHeight - ch));
  }

  return {
    left: Math.max(0, Math.min(left, imageWidth - cw)),
    top: Math.max(0, Math.min(top, imageHeight - ch)),
    width: cw,
    height: ch,
  };
}

export function centerCropBox(imageWidth: number, imageHeight: number, ratio: number): CropRect {
  let cw = imageWidth;
  let ch = imageHeight;
  if (imageWidth / imageHeight > ratio) cw = Math.floor(imageHeight * ratio);
  else ch = Math.floor(imageWidth / ratio);
  return {
    left: Math.floor((imageWidth - cw) / 2),
    top: Math.floor((imageHeight - ch) / 2),
    width: Math.max(1, cw),
    height: Math.max(1, ch),
  };
}

/** 检测图中人脸，返回主体框；模型失败/无人脸返回 null */
export async function detectPrimaryFace(imagePath: string): Promise<FaceBox | null> {
  const ok = await ensureFaceNets();
  if (!ok) return null;

  const sharp = (await import("sharp")).default;
  const tf = await import("@tensorflow/tfjs");
  const faceapi = await import("@vladmandic/face-api");

  const { data, info } = await sharp(imagePath)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (w < 16 || h < 16) return null;

  // TinyFaceDetector 输入边长；大图用 416 平衡速度与小脸
  const inputSize = Math.max(w, h) >= 900 ? 416 : 320;
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold: 0.35,
  });

  const tensor = tf.tensor3d(new Uint8Array(data), [h, w, 3]);
  try {
    const detections = await faceapi.detectAllFaces(tensor as never, options);
    const faces: FaceBox[] = detections.map((d) => ({
      left: Math.max(0, Math.round(d.box.x)),
      top: Math.max(0, Math.round(d.box.y)),
      width: Math.max(1, Math.round(d.box.width)),
      height: Math.max(1, Math.round(d.box.height)),
      score: d.score,
    }));
    return selectPrimaryFace(faces, w);
  } catch {
    return null;
  } finally {
    tensor.dispose();
  }
}

/**
 * face 模式裁剪框：有人脸则锚点裁切，否则居中。
 * 返回 { rect, method }
 */
export async function resolveFaceCropRect(
  imagePath: string,
  imageWidth: number,
  imageHeight: number,
  ratio: number,
): Promise<{ rect: CropRect; method: "face" | "center" }> {
  const face = await detectPrimaryFace(imagePath);
  if (face) {
    return {
      rect: faceFocusBox(imageWidth, imageHeight, face, ratio),
      method: "face",
    };
  }
  return {
    rect: centerCropBox(imageWidth, imageHeight, ratio),
    method: "center",
  };
}

/** 测试用：重置模型懒加载状态 */
export function resetFaceNetsForTests() {
  netsReady = null;
}
