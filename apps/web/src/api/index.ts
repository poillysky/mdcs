export { ApiError, api } from "./client.js";
export { fetchHealth } from "./health.js";
export {
  fetchKinds,
  fetchIndexFolders,
  updateKind,
  updateOrganizeConfig,
  scanKind,
} from "./kinds.js";
export {
  fetchJobs,
  fetchJob,
  createJob,
  pauseJob,
  resumeJob,
  cancelJob,
  deleteJob,
} from "./jobs.js";
export {
  fetchFiles,
  fetchFileDetail,
  fetchFilePipelineLog,
  fetchFileGallery,
  fetchCoverCropSource,
  fetchCoverCropBrowse,
  uploadCoverCropImage,
  submitCoverCrop,
  retryFile,
  retryFiles,
  stopFiles,
  reorganizeFiles,
  deleteFiles,
  scrapeIndexedFiles,
  runFileTaskAction,
  rescrapeFile,
  updateFileMeta,
  ensureFileSourceSnapshots,
  startIndexAll,
  fetchIndexAllStatus,
  type PipelineLogStepView,
  type PipelineRunKind,
  type PipelineRunView,
  type CoverCropStyle,
  type CoverCropMarks,
  type CoverCropSourceInfo,
  type CoverCropBrowseEntry,
  type FileTaskActionMode,
  type IndexAllStatus,
} from "./files.js";
export {
  scrapeCode,
  fetchScrapeConfig,
  saveScrapeConfig,
  probeProviders,
  testNetworkConnection,
  fetchWatermarkStyles,
} from "./scrape.js";
export {
  fetchOpsConfig,
  saveOpsConfig,
  testWebhookEndpoint,
  exportPresets,
  importPresets,
  savePreset,
  deletePreset,
  testEmbyActorsConnection,
  fetchEmbyLibraries,
  syncEmbyActors,
} from "./ops.js";
export { fetchActors, fetchActorDetail, scrapeActors } from "./actors.js";
export { fetchDashboard, type DashboardWeekCompare } from "./dashboard.js";

export type {
  FileRow,
  HealthInfo,
  JobRow,
  KindRow,
  ScrapeConfig,
} from "../types/index.js";
