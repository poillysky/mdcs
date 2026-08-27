const ids = [85782, 85780, 85761, 85725];
for (const id of ids) {
  const res = await fetch(`http://127.0.0.1:9210/api/files/${id}`);
  const json = await res.json();
  const f = json.data?.file;
  if (!f) {
    console.log(id, "missing");
    continue;
  }
  console.log(
    id,
    f.kind,
    f.status,
    f.code,
    f.source_path?.replace(/\\/g, "/"),
  );
}

const root = "media/本地索引/日本有码";
const q = new URLSearchParams({ sourceRoot: root, page: "1", pageSize: "5" });
const all = await fetch(`http://127.0.0.1:9210/api/files?${q}`).then((r) => r.json());
console.log("sourceRoot only total", all.data?.total);

const q2 = new URLSearchParams({ page: "1", pageSize: "5" });
const unfiltered = await fetch(`http://127.0.0.1:9210/api/files?${q2}`).then((r) => r.json());
console.log("no filter total", unfiltered.data?.total);
for (const f of unfiltered.data?.files ?? []) {
  console.log("top", f.id, f.kind, f.code, f.source_path?.replace(/\\/g, "/").slice(-50));
}
