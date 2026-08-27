import { Router } from "express";
import { queryDashboard } from "../dashboard/query.js";
import { sendOk } from "./respond.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (req, res) => {
  const data = queryDashboard({
    activityPage: parseInt(String(req.query.page ?? "1"), 10) || 1,
    activityPageSize: parseInt(String(req.query.pageSize ?? "20"), 10) || 20,
    activityKind: req.query.kind ? String(req.query.kind) : undefined,
  });
  sendOk(res, data);
});
