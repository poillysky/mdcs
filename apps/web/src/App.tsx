import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFiles, fetchHealth, fetchJobs, fetchKinds } from "./api";
import { AppShell } from "./layout/AppShell";
import { ToastStack } from "./components/ToastStack";
import { localizeMessage, toastTitle } from "./lib/messages";
import { useJobEvents } from "./hooks/useJobEvents";
import {
  applyIndexAllUpdate,
  onIndexAllComplete,
} from "./hooks/indexAllStore";
import { refreshIndexAllStatus } from "./hooks/useSharedIndexAll";
import { matchRoute, normalizePath } from "./lib/routes";
import type { NotifyFn, ToastItem } from "./lib/notify";
import { DashboardPage } from "./pages/DashboardPage";
import { KindTasksPage } from "./pages/KindTasksPage";
import { JobsPage } from "./pages/JobsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { ActorsPage } from "./pages/ActorsPage";
import { FilesPage } from "./pages/FilesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";
import type { FileRow, HealthInfo, JobRow, KindRow } from "./types";

const TOAST_TTL = 4800;

function usePathRoute() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPop = () => {
      setPath(normalizePath(window.location.pathname));
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: string) => {
    const url = new URL(next, window.location.origin);
    const normalized = normalizePath(url.pathname);
    const target = `${normalized}${url.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (target !== current) {
      window.history.pushState({}, "", target);
    }
    setPath(normalized);
    setSearch(url.search);
  }, []);

  return { path, search, route: matchRoute(path), navigate };
}

export function App() {
  const { path, search, route, navigate } = usePathRoute();
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [kinds, setKinds] = useState<KindRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileFailedTotal, setFileFailedTotal] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const dataReady = useRef(false);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<NotifyFn>(
    (level, message, title) => {
      const id = `t${Date.now()}_${seq.current++}`;
      const item: ToastItem = {
        id,
        level,
        title: toastTitle(level, title),
        message: localizeMessage(message),
      };
      setToasts((prev) => [...prev, item].slice(-5));
      const timer = setTimeout(() => dismissToast(id), TOAST_TTL);
      timers.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? dataReady.current;
      if (!silent) setLoading(true);
      try {
        const [h, k, j, f, failedRes] = await Promise.all([
          fetchHealth(),
          fetchKinds(),
          fetchJobs({ pageSize: 200 }),
          fetchFiles({ pageSize: 100 }),
          fetchFiles({ status: "failed", pageSize: 1 }),
        ]);
        setHealth(h);
        setKinds(k.kinds);
        setJobs(j.jobs);
        setFiles(f.files);
        setFileFailedTotal(failedRes.total);
        dataReady.current = true;
      } catch (e) {
        notify("error", e, "无法刷新数据");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    const normalized = normalizePath(window.location.pathname);
    if (normalized !== window.location.pathname) {
      window.history.replaceState({}, "", normalized);
    }
    void refresh();
    void refreshIndexAllStatus();
  }, [refresh]);

  useEffect(() => {
    return onIndexAllComplete((index) => {
      if (index.error) notify("error", index.error);
      else notify("ok", index.message || "全量索引已完成");
      void refresh({ silent: true });
    });
  }, [notify, refresh]);

  useEffect(() => {
    const interval =
      route === "tasks" || route === "kindTasks"
        ? 30000
        : route === "files"
          ? null
          : route === "records"
            ? null
            : 15000;
    if (!interval) return;
    const t = setInterval(() => void refresh({ silent: true }), interval);
    return () => clearInterval(t);
  }, [refresh, route]);

  useJobEvents({
    onJobUpdate: (job) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = job;
          return next;
        }
        return [job, ...prev].slice(0, 50);
      });
    },
    onIndexUpdate: applyIndexAllUpdate,
  });

  function renderPage() {
    switch (route) {
      case "dashboard":
        return (
          <DashboardPage
            jobs={jobs}
            kinds={kinds}
            fileFailedTotal={fileFailedTotal}
            onNavigate={navigate}
            notify={notify}
          />
        );
      case "tasks":
        return (
          <JobsPage
            kinds={kinds}
            loading={loading}
            onChanged={() => void refresh()}
            onNavigate={navigate}
            notify={notify}
          />
        );
      case "kindTasks":
        return (
          <KindTasksPage
            kinds={kinds}
            jobs={jobs}
            loading={loading}
            onChanged={() => void refresh()}
            onNavigate={navigate}
            notify={notify}
          />
        );
      case "records":
        return <RecordsPage kinds={kinds} locationSearch={search} onNavigate={navigate} notify={notify} />;
      case "actors":
        return (
          <ActorsPage
            path={path}
            locationSearch={search}
            onNavigate={navigate}
            notify={notify}
          />
        );
      case "files":
        return (
          <FilesPage
            kinds={kinds}
            loading={loading}
            onChanged={() => void refresh()}
            onNavigate={navigate}
            notify={notify}
          />
        );
      case "sources":
        return <SourcesPage path={path} onNavigate={navigate} notify={notify} />;
      case "settings":
        return (
          <SettingsPage
            path={path}
            kinds={kinds}
            loading={loading}
            onNavigate={navigate}
            onChanged={() => void refresh()}
            notify={notify}
          />
        );
      default:
        return null;
    }
  }

  return (
    <>
      <AppShell route={route} onNavigate={navigate}>
        {renderPage()}
      </AppShell>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
