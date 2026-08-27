for (const url of ["http://127.0.0.1:9210/health", "http://localhost:3050"]) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    console.log(url, res.status);
  } catch (err) {
    console.log(url, "fail", err instanceof Error ? err.message : err);
  }
}
