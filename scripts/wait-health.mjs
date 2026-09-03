/** Wait until API health responds, then exit 0 (for dev:all web boot). */
const url = process.env.MDCS_HEALTH_URL || "http://127.0.0.1:9210/health";
const timeoutMs = Number(process.env.MDCS_HEALTH_WAIT_MS || 60000);
const started = Date.now();

async function once() {
  try {
    const res = await fetch(url);
    if (res.ok) return true;
  } catch {
    /* not ready */
  }
  return false;
}

while (Date.now() - started < timeoutMs) {
  if (await once()) {
    console.log(`[wait-health] ready ${url}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.error(`[wait-health] timeout after ${timeoutMs}ms: ${url}`);
process.exit(1);
