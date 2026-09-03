import { useEffect, useMemo, useRef, useState } from "react";
import { fetchFilePipelineLog } from "../../../api";
import type { FileRow, ScrapeMetaView } from "../../../types";
import type { LogRunOption, LogStep } from "../types";
import {
  buildLogSteps,
  expandPipelineLogSteps,
  expandPipelineLogText,
  mergeLogSteps,
  normalizeLogItemTone,
  parseScrapedAtMs,
  pickLatestLogRun,
  sortLogRunsChronological,
  toLogRunOption,
} from "../pipelineLog";

export function usePipelineLog(
  detailId: number,
  file: FileRow | null,
  meta: ScrapeMetaView | null,
  libraryRoot?: string,
) {
  const [pipelineSteps, setPipelineSteps] = useState<LogStep[] | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<LogRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGenRef = useRef(0);
  const pipelineWaitRefreshRef = useRef(false);

  const stopPipelinePoll = () => {
    pollGenRef.current += 1;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyPipelineLog = (
    p: Awaited<ReturnType<typeof fetchFilePipelineLog>>,
    opts?: { keepSelectedRun?: boolean },
  ) => {
    const runs = (p.runs ?? []).map(toLogRunOption);
    setPipelineRuns(runs);
    // 仅 active 时保持「进行中」；结束后即使内存里还有 steps 也退出
    if (p.active) {
      const liveSteps = (p.steps ?? []).map((step) => ({
        title: step.title,
        done: step.done,
        items: (step.items ?? []).map((item) => {
          const text = expandPipelineLogText(item.text, libraryRoot);
          return {
            tone: normalizeLogItemTone(text, item.tone),
            text,
          };
        }),
      }));
      setPipelineSteps(liveSteps.length ? liveSteps : []);
      setSelectedRunId("__live__");
      return true;
    }
    setPipelineSteps(null);
    if (runs.length) {
      const latest = pickLatestLogRun(runs)!;
      if (opts?.keepSelectedRun) {
        setSelectedRunId((prev) =>
          prev && prev !== "__live__" && runs.some((r) => r.id === prev) ? prev : latest.id,
        );
      } else {
        setSelectedRunId(latest.id);
      }
    } else {
      setSelectedRunId("");
    }
    return false;
  };

  const startPipelinePoll = (fileId: number) => {
    stopPipelinePoll();
    const gen = pollGenRef.current;
    pollRef.current = setInterval(() => {
      void fetchFilePipelineLog(fileId)
        .then((p) => {
          if (gen !== pollGenRef.current) return;
          const stillActive = applyPipelineLog(p);
          if (!stillActive) stopPipelinePoll();
        })
        .catch(() => {
          /* 轮询静默失败 */
        });
    }, 400);
  };

  useEffect(() => {
    setPipelineSteps(null);
    setPipelineRuns([]);
    setSelectedRunId("");
    stopPipelinePoll();
  }, [detailId]);

  useEffect(() => {
    if (pipelineWaitRefreshRef.current && pipelineSteps === null && !pollRef.current) {
      pipelineWaitRefreshRef.current = false;
    }
  }, [meta, file?.status, file?.organized_at, file?.scraped_at, pipelineSteps]);

  useEffect(
    () => () => {
      stopPipelinePoll();
    },
    [],
  );

  useEffect(() => {
    if (!file?.id) {
      setPipelineRuns([]);
      setSelectedRunId("");
      return;
    }
    let cancelled = false;
    void fetchFilePipelineLog(file.id)
      .then((p) => {
        if (cancelled) return;
        const stillActive = applyPipelineLog(p, { keepSelectedRun: true });
        if (stillActive) startPipelinePoll(file.id);
        else stopPipelinePoll();
      })
      .catch(() => {
        if (!cancelled) setPipelineRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.scraped_at, file?.organized_at, meta?.scrapedAt]);

  const logRunOptions = useMemo((): LogRunOption[] => {
    if (!file) return [];
    let options = [...pipelineRuns];
    const hasInitial = options.some((r) => r.kind === "initial");
    if (!hasInitial) {
      if (options.length) {
        // 无首次归档时：用时间最早的一条充当首次，勿用最新 scraped_at
        const oldest = options.reduce((best, r) => (r.at < best.at ? r : best));
        options = options.map((r) =>
          r.id === oldest.id ? { ...r, kind: "initial" as const } : r,
        );
      } else {
        options.push({
          id: `initial-${file.id}`,
          kind: "initial",
          at: parseScrapedAtMs(file, meta),
          steps: buildLogSteps(file, meta, libraryRoot),
        });
      }
    }
    return sortLogRunsChronological(options);
  }, [file, meta, pipelineRuns, libraryRoot]);

  const latestLogRun = useMemo(
    () => pickLatestLogRun(logRunOptions),
    [logRunOptions],
  );

  const selectedLogRun = useMemo(() => {
    if (!logRunOptions.length) return null;
    return logRunOptions.find((r) => r.id === selectedRunId) ?? latestLogRun ?? null;
  }, [logRunOptions, selectedRunId, latestLogRun]);

  const logSteps = useMemo(() => {
    const synthesized = file ? buildLogSteps(file, meta, libraryRoot) : [];
    // 进行中：只展示本轮实时流水线，不掺上一轮 meta 合成的步骤
    if (pipelineSteps !== null) {
      return expandPipelineLogSteps(pipelineSteps, libraryRoot);
    }
    const archived = selectedLogRun?.steps ?? [];
    const steps = archived.length ? mergeLogSteps(archived, synthesized) : synthesized;
    return expandPipelineLogSteps(steps, libraryRoot);
  }, [file, meta, pipelineSteps, selectedLogRun, libraryRoot]);

  useEffect(() => {
    if (pipelineSteps !== null) return;
    if (!selectedRunId && latestLogRun) {
      setSelectedRunId(latestLogRun.id);
    } else if (
      selectedRunId &&
      selectedRunId !== "__live__" &&
      logRunOptions.length &&
      !logRunOptions.some((r) => r.id === selectedRunId)
    ) {
      setSelectedRunId(latestLogRun?.id ?? "");
    }
  }, [logRunOptions, selectedRunId, pipelineSteps, latestLogRun]);

  return {
    pipelineSteps,
    setPipelineSteps,
    selectedRunId,
    setSelectedRunId,
    logRunOptions,
    selectedLogRun,
    latestLogRun,
    logSteps,
    startPipelinePoll,
    stopPipelinePoll,
    applyPipelineLog,
    pipelineWaitRefreshRef,
  };
}
