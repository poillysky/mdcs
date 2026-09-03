import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { COVERS_DIR } from "../paths.js";
import {
  deleteCoverCacheFiles,
  isCoverFileReadable,
  isLibraryOrganizedImage,
  MIN_COVER_IMAGE_BYTES,
  resolveOrganizeCoverSource,
  sanitizeCoverSourceForPoster,
  shouldPurgeCoverCacheAfterOrganize,
} from "./coverCache.js";

const coverBytes = () => Buffer.alloc(MIN_COVER_IMAGE_BYTES, 0xff);

test("resolveOrganizeCoverSource prefers existing coverLocal", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const coverDir = path.join(root, "data", "covers", "jav");
  fs.mkdirSync(coverDir, { recursive: true });
  const coverFile = path.join(coverDir, "ABC-123.jpg");
  fs.writeFileSync(coverFile, coverBytes());

  const posterCandidate = path.join(root, "media", "jav", "ABC-123", "poster.jpg");
  fs.mkdirSync(path.dirname(posterCandidate), { recursive: true });
  fs.writeFileSync(posterCandidate, coverBytes());

  const resolved = resolveOrganizeCoverSource({
    meta: { coverLocal: "data/covers/jav/ABC-123.jpg" },
    projectRoot: root,
    posterAbsCandidate: posterCandidate,
  });
  assert.equal(resolved, coverFile);
});

test("resolveOrganizeCoverSource ignores library poster when coverLocal missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const posterCandidate = path.join(root, "media", "jav", "ABC-123", "poster.jpg");
  fs.mkdirSync(path.dirname(posterCandidate), { recursive: true });
  fs.writeFileSync(posterCandidate, coverBytes());

  const resolved = resolveOrganizeCoverSource({
    meta: {},
    projectRoot: root,
    posterAbsCandidate: posterCandidate,
  });
  assert.equal(resolved, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test("isLibraryOrganizedImage detects poster and thumb beside video", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const dir = path.join(root, "movie");
  fs.mkdirSync(dir, { recursive: true });
  const poster = path.join(dir, "poster.jpg");
  const thumb = path.join(dir, "thumb.jpg");
  fs.writeFileSync(poster, coverBytes());
  fs.writeFileSync(thumb, coverBytes());
  assert.equal(isLibraryOrganizedImage(poster, poster), true);
  assert.equal(isLibraryOrganizedImage(thumb, poster), true);
  assert.equal(isLibraryOrganizedImage(path.join(dir, "cover.jpg"), poster), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("deleteCoverCacheFiles removes cached covers", () => {
  const code = `TEST-PURGE-${Date.now()}`;
  const coverDir = path.join(COVERS_DIR, "japan_censored");
  fs.mkdirSync(coverDir, { recursive: true });
  const coverFile = path.join(coverDir, `${code}.png`);
  fs.writeFileSync(coverFile, "x");
  try {
    deleteCoverCacheFiles(code, "japan_censored");
    assert.equal(fs.existsSync(coverFile), false);
  } finally {
    if (fs.existsSync(coverFile)) fs.unlinkSync(coverFile);
  }
});

test("sanitizeCoverSourceForPoster drops missing files", () => {
  assert.equal(sanitizeCoverSourceForPoster("/no/such/poster.jpg"), null);
});

test("sanitizeCoverSourceForPoster keeps readable files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const poster = path.join(root, "poster.jpg");
  fs.writeFileSync(poster, coverBytes());
  assert.equal(sanitizeCoverSourceForPoster(poster), poster);
});

test("isCoverFileReadable false for missing poster path", () => {
  assert.equal(isCoverFileReadable("/no/such/poster.jpg"), false);
});

test("isCoverFileReadable false for tiny poster", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const tiny = path.join(root, "poster.jpg");
  fs.writeFileSync(tiny, Buffer.alloc(521));
  assert.equal(isCoverFileReadable(tiny), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("resolveOrganizeCoverSource skips tiny library poster", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const posterCandidate = path.join(root, "media", "jav", "ABC-123", "poster.jpg");
  fs.mkdirSync(path.dirname(posterCandidate), { recursive: true });
  fs.writeFileSync(posterCandidate, Buffer.alloc(521));

  const resolved = resolveOrganizeCoverSource({
    meta: {},
    projectRoot: root,
    posterAbsCandidate: posterCandidate,
  });
  assert.equal(resolved, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test("resolveOrganizeCoverSource skips missing library poster", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdcs-cover-"));
  const posterCandidate = path.join(root, "media", "jav", "ABC-123", "poster.jpg");
  fs.mkdirSync(path.dirname(posterCandidate), { recursive: true });

  const resolved = resolveOrganizeCoverSource({
    meta: {},
    projectRoot: root,
    posterAbsCandidate: posterCandidate,
  });
  assert.equal(resolved, null);
});

test("shouldPurgeCoverCacheAfterOrganize when coverLocal exists", () => {
  assert.equal(shouldPurgeCoverCacheAfterOrganize(null, { coverLocal: "data/covers/x.jpg" }), true);
  assert.equal(shouldPurgeCoverCacheAfterOrganize(null, {}), false);
});
