import { useCallback, useEffect, useRef, useState } from "react";
import type { JobEvent, JobRow } from "../types";

type Handlers = {
  onJobUpdate?: (job: JobRow) => void;
  onJobEvent?: (event: JobEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function useJobEvents(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${window.location.host}/api/events`);

      ws.onopen = () => {
        handlersRef.current.onConnected?.();
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            job?: JobRow;
            event?: JobEvent;
          };
          if (msg.type === "job_update" && msg.job) {
            handlersRef.current.onJobUpdate?.(msg.job);
          }
          if (msg.type === "job_event" && msg.event) {
            handlersRef.current.onJobEvent?.(msg.event);
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        handlersRef.current.onDisconnected?.();
        if (!closed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);
}

/** 实时事件日志（调试浮层可用） */
export function useJobEventLog(maxItems = 200) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useJobEvents({
    onConnected: () => setConnected(true),
    onDisconnected: () => setConnected(false),
    onJobEvent: (event) => {
      setEvents((prev) => [...prev, event].slice(-maxItems));
    },
  });

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, clear };
}
