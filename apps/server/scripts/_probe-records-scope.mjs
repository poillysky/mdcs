const ids = [85782, 85780, 85761, 85725];
for (const id of ids) {
  const res = await fetch(`http://127.0.0.1:9210/api/files/${id}`);
  const json = await res.json();
  const f = json.data?.file;
  if (!f) {
    console.log(id, "missing");
    continue;
  }
  console.log(id, f.kind, f.status, f.code, f.source_path?.replace(/\\/g, "/"));
}

const root = "media/本地索引/日本有码";
const scoped = await fetch(
  `http://127.0.0.1:9210/api/files?${new URLSearchParams({
    kind: "japan_censored",
    sourceRoot: root,
    page: "1",
    pageSize: "3",
  })}`,
).then((r) => r.json());
console.log("kind+sourceRoot total", scoped.data?.total);

const sourceOnly = await fetch(
  `http://127.0.0.1:9210/api/files?${new URLSearchParams({
    sourceRoot: root,
    page: "1",
    pageSize: "3",
  })}`,
).then((r) => r.json());
console.log("sourceRoot only total", sourceOnly.data?.total);

const unfiltered = await fetch(
  `http://127.0.0.1:9210/api/files?${new URLSearchParams({ page: "1", pageSize: "8" })}`,
).then((r) => r.json());
console.log("no filter total", unfiltered.data?.total);
for (const f of unfiltered.data?.files ?? []) {
  console.log("top", f.id, f.kind, f.code, f.source_path?.replace(/\\/g, "/").slice(-55));
}
