import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centerCropBox, faceFocusBox, selectPrimaryFace } from "./faceCrop.js";

describe("selectPrimaryFace", () => {
  it("优先更大更靠右的高分脸", () => {
    const pick = selectPrimaryFace(
      [
        { left: 10, top: 10, width: 40, height: 40, score: 0.9 },
        { left: 200, top: 20, width: 80, height: 80, score: 0.85 },
      ],
      400,
    );
    assert.ok(pick);
    assert.equal(pick!.left, 200);
  });
});

describe("faceFocusBox", () => {
  it("裁框包含人脸且比例接近目标", () => {
    const face = { left: 300, top: 80, width: 120, height: 140, score: 0.9 };
    const box = faceFocusBox(800, 600, face, 2 / 3);
    assert.ok(box.width / box.height <= 2 / 3 + 0.05);
    assert.ok(box.left >= 0 && box.top >= 0);
    assert.ok(box.left + box.width <= 800);
    assert.ok(box.top + box.height <= 600);
    // 脸中心应大致落在框内
    const cx = face.left + face.width / 2;
    const cy = face.top + face.height / 2;
    assert.ok(cx >= box.left && cx <= box.left + box.width);
    assert.ok(cy >= box.top && cy <= box.top + box.height);
  });
});

describe("centerCropBox", () => {
  it("居中裁切", () => {
    const box = centerCropBox(900, 600, 2 / 3);
    assert.equal(box.left, Math.floor((900 - box.width) / 2));
    assert.equal(box.top, Math.floor((600 - box.height) / 2));
  });
});
