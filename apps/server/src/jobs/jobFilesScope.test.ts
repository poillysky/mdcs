import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildJobFilesScopeWhere, jobHasBoundedFileScope } from "./jobFilesScope.js";

describe("jobFilesScope", () => {
  it("scanPath 任务使用路径范围而非 job_id", () => {
    const scope = buildJobFilesScopeWhere(
      {
        id: "job_test",
        kinds: ["japan_censored"],
        options: { scanPath: "media/test-scope/foo" },
      },
      "f",
    );
    assert.ok(scope);
    assert.match(scope.sql, /f\.kind IN/);
    assert.match(scope.sql, /f\.source_path/);
    assert.deepEqual(scope.params, ["japan_censored", "media/test-scope/foo", "media/test-scope/foo/%"]);
  });

  it("fileIds 任务使用 id 列表", () => {
    const scope = buildJobFilesScopeWhere(
      {
        id: "job_test",
        kinds: ["japan_censored"],
        options: { fileIds: [1, 2] },
      },
      "f",
    );
    assert.ok(scope);
    assert.equal(scope.sql, "f.id IN (?,?)");
    assert.deepEqual(scope.params, [1, 2]);
  });

  it("jobHasBoundedFileScope 识别 scanPath/fileIds", () => {
    assert.equal(
      jobHasBoundedFileScope({
        id: "j",
        kinds: ["japan_censored"],
        options: { scanPath: "media/x" },
      }),
      true,
    );
    assert.equal(
      jobHasBoundedFileScope({
        id: "j",
        kinds: ["japan_censored"],
        options: {},
      }),
      false,
    );
  });
});
