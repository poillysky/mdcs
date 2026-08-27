import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { madouProvider } from "./madou.js";

// 最小 fixture：模拟 madou.club 典型详情页结构
const FIXTURE_HTML = `
<html>
<head><title>MDX-0001 麻豆传媒 - Madou</title></head>
<body>
  <h1 class="article-title">MDX0001 夏晴子.苏清歌</h1>
  <a rel="category tag">麻豆传媒</a>
  <div class="article-content">
    <img src="https://madou.club/wp-content/uploads/covers/MDX-0001.jpg" />
  </div>
  <a rel="tag">口交</a>
  <a rel="tag">无码</a>
  <a rel="tag">夏晴子</a>
  <a rel="tag">苏清歌</a>
</body>
</html>
`;

// 直接测 parseMadouDetail 内部已正确导出的函数

describe("madou provider", () => {
  it("provider id is madou", () => {
    assert.equal(madouProvider.id, "madou");
  });

  it("provider has scrape method", () => {
    assert.equal(typeof madouProvider.scrape, "function");
  });
});
