import type { IndexAllStatus } from "../types";

type CompleteListener = (index: IndexAllStatus) => void;

let snapshot: IndexAllStatus | null = null;
let wasRunning = false;
const subscribers = new Set<() => void>();
const completeListeners = new Set<CompleteListener>();

export function subscribeIndexAllStatus(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);
  return () => subscribers.delete(onStoreChange);
}

export function getIndexAllStatusSnapshot(): IndexAllStatus | null {
  return snapshot;
}

function notifySubscribers() {
  for (const s of subscribers) s();
}

export function onIndexAllComplete(listener: CompleteListener): () => void {
  completeListeners.add(listener);
  return () => completeListeners.delete(listener);
}

/** WebSocket / 服务端推送 */
export function applyIndexAllUpdate(index: IndexAllStatus) {
  if (index.running) {
    wasRunning = true;
    snapshot = index;
    notifySubscribers();
    return;
  }
  const completed = wasRunning;
  const final = index;
  wasRunning = false;
  snapshot = null;
  notifySubscribers();
  if (completed) {
    for (const l of completeListeners) l(final);
  }
}

/** 用户点击「全量索引」后立刻写入，避免等待首包 WS */
export function setIndexAllRunning(index: IndexAllStatus) {
  wasRunning = true;
  snapshot = index;
  notifySubscribers();
}

/** 启动时从 API 恢复进行中的索引 */
export function syncIndexAllFromServer(index: IndexAllStatus) {
  if (index.running) {
    wasRunning = true;
    snapshot = index;
    notifySubscribers();
    return;
  }
  if (!wasRunning) {
    snapshot = null;
    notifySubscribers();
  }
}
