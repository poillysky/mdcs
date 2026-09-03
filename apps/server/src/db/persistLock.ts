/** 刮削/整理入库串行锁：并发 worker 可并行拉网，写 SQLite + 元数据 JSON 时错开 */
let chain: Promise<void> = Promise.resolve();

const DEFAULT_STAGGER_MS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 串行执行入库相关逻辑，避免多 worker 同时写 scrape_cache / files。
 * 默认每条入库后错开 40ms，减轻 WAL 瞬时争用。
 */
export async function withPersistLock<T>(
  fn: () => T | Promise<T>,
  opts?: { staggerMs?: number },
): Promise<T> {
  const staggerMs = opts?.staggerMs ?? DEFAULT_STAGGER_MS;
  const run = chain.then(async () => {
    const result = await fn();
    if (staggerMs > 0) await sleep(staggerMs);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 测试用：重置锁链 */
export function resetPersistLockForTests(): void {
  chain = Promise.resolve();
}
