import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJdbstaticImageUrl } from "./jdbstaticImage.js";

describe("isJdbstaticImageUrl", () => {
  it("matches jdbstatic sample paths", () => {
    assert.equal(
      isJdbstaticImageUrl("https://c0.jdbstatic.com/samples/d4/d421VQ_l_0.jpg"),
      true,
    );
  });

  it("rejects non-jdbstatic", () => {
    assert.equal(isJdbstaticImageUrl("https://example.test/x.jpg"), false);
  });
});
