const jobs = await fetch("http://127.0.0.1:9210/api/jobs?page=1&pageSize=5").then((r) => r.json());
const list = jobs.data?.jobs ?? jobs.data ?? [];
console.log("jobs sample", Array.isArray(list) ? list.slice(0, 3).map((j) => ({
  id: j.id,
  status: j.status,
  mode: j.mode,
  kinds: j.kinds,
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
  processed: j.processed,
  total: j.total,
})) : jobs);

const kinds = await fetch("http://127.0.0.1:9210/api/kinds").then((r) => r.json());
const jc = (kinds.data?.kinds ?? []).find((k) => k.id === "japan_censored");
console.log("japan_censored sourceRoot", jc?.sourceRoot);

if (Array.isArray(list) && list[0]) {
  const jobId = list[0].id;
  const scoped = await fetch(`http://127.0.0.1:9210/api/files?jobId=${encodeURIComponent(jobId)}&page=1&pageSize=5`).then((r) => r.json());
  console.log("job scoped total", scoped.data?.total, "ok", scoped.ok, scoped.message);
  for (const f of scoped.data?.files ?? []) {
    console.log(" ", f.id, f.kind, f.code, f.source_path?.replace(/\\/g, "/").slice(-70));
  }
}
