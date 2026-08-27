import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identifyFromFileName, identifyFromPath } from "./identify.js";

/** ≥30 fixtures：对齐 JavSP avid 关键规则 + MDCS FC2-PPV */
const FIXTURES: Array<{ file: string; code: string | null; cd?: number }> = [
  { file: "ABC-123.mp4", code: "ABC-123" },
  { file: "abc_456.mkv", code: "ABC-456" },
  { file: "IPX-177.mp4", code: "IPX-177" },
  { file: "ssis001.mp4", code: "SSIS-001" },
  { file: "SSIS001.mp4", code: "SSIS-001" },
  { file: "ABP123.mp4", code: "ABP-123" },
  { file: "FC2-1234567.mkv", code: "FC2-1234567" },
  { file: "FC2_1234567.mp4", code: "FC2-1234567" },
  { file: "FC2-PPV-1234567.mp4", code: "FC2-PPV-1234567" },
  { file: "fc2ppv_7654321.mp4", code: "FC2-PPV-7654321" },
  { file: "HEYDOUGA-4011-123.mp4", code: "HEYDOUGA-4011-123" },
  { file: "heydouga_4011_0123.mp4", code: "HEYDOUGA-4011-123" },
  { file: "HEY-4011-123.mp4", code: "HEYDOUGA-4011-123" },
  { file: "GETCHU-12345.mp4", code: "GETCHU-12345" },
  { file: "GETCHU_999.avi", code: "GETCHU-999" },
  { file: "GYUTTO-456.mp4", code: "GYUTTO-456" },
  { file: "259LUXU-001.mp4", code: "259LUXU-001" },
  { file: "www.FOO.COM_IPX-177.mp4", code: "IPX-177" },
  { file: "bar.NET-SSIS-200.mp4", code: "SSIS-200" },
  { file: "MKBD-S12.mp4", code: "MKBD-S12" },
  { file: "MK3D2DBD-01.mp4", code: "MK3D2DBD-01" },
  { file: "S2M-12.mp4", code: "S2M-12" },
  { file: "IBW-123z.mp4", code: "IBW-123z" },
  { file: "RED012.mp4", code: "RED012" },
  { file: "SKY012.mp4", code: "SKY012" },
  { file: "EX0001.mp4", code: "EX0001" },
  { file: "T28-557.mp4", code: "T28-557" },
  { file: "N1234.mp4", code: "N1234" },
  { file: "K5678.mp4", code: "K5678" },
  { file: "R18-001.mp4", code: "R18-001" },
  { file: "R18002.mp4", code: "R18-002" },
  { file: "123456-01.mp4", code: "123456-01" },
  { file: "123456_12.mp4", code: "123456-12" },
  { file: "ABC)(123.mp4", code: "ABC-123" },
  { file: "ABC-123-cd2.mp4", code: "ABC-123", cd: 2 },
  { file: "IPX-177_part3.mkv", code: "IPX-177", cd: 3 },
  { file: "random_video.mp4", code: null },
];

describe("identifyFromFileName v2", () => {
  for (const row of FIXTURES) {
    it(`${row.file} → ${row.code ?? "null"}`, () => {
      const r = identifyFromFileName(row.file);
      assert.equal(r.code, row.code);
      if (row.cd != null) assert.equal(r.cdIndex, row.cd);
    });
  }

  it("fixture 数量不少于 30", () => {
    assert.ok(FIXTURES.length >= 30, `实际 ${FIXTURES.length}`);
  });

  it("路径回退：文件无名时用父目录", () => {
    const r = identifyFromPath("D:/library/IPX-177/unknown.mp4");
    assert.equal(r.code, "IPX-177");
  });
});
