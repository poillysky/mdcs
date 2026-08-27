/**
 * 固定并发 worker 池。快/慢通道各自独立，互不占用对方槽位。
 * 单个 worker 抛错不会拖死整池。
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (!items.length) return;
  const limit = Math.max(1, concurrency);
  let next = 0;

  async function pump(): Promise<void> {
    while (next < items.length) {
      if (signal?.aborted) return;
      const index = next;
      next += 1;
      try {
        await worker(items[index]!);
      } catch {
        /* 隔离：单项失败继续 */
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => pump());
  await Promise.all(workers);
}
