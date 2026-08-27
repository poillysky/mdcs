import { Router } from "express";
import { registerListRoutes } from "./listRoutes.js";
import { registerAssetRoutes } from "./assetRoutes.js";
import { registerDetailRoutes } from "./detailRoutes.js";
import { registerBatchRoutes } from "./batchRoutes.js";
import { registerSnapshotRoutes } from "./snapshotRoutes.js";
import { registerPipelineRoutes } from "./pipelineRoutes.js";
import { registerActionRoutes } from "./actionRoutes.js";

export { coverCropUploadParser } from "./parsers.js";

export const filesRouter = Router();

registerListRoutes(filesRouter);
registerAssetRoutes(filesRouter);
registerDetailRoutes(filesRouter);
registerBatchRoutes(filesRouter);
registerSnapshotRoutes(filesRouter);
registerPipelineRoutes(filesRouter);
registerActionRoutes(filesRouter);
