import { openDatabase } from "../src/db/init.js";

const db = openDatabase();
const codes = ["HMN-737", "HMN-739", "HMN-740", "HMN-741"];
const stuck = db
  .prepare(
    `SELECT f.id, f.code, f.status, f.job_id, f.scraped_at, f.organized_at, j.status AS job_status
     FROM files f
     LEFT JOIN jobs j ON j.id = f.job_id
     WHERE f.code IN (${codes.map(() => "?").join(",")})`,
  )
  .all(...codes);
console.log("target codes:", JSON.stringify(stuck, null, 2));

const inflight = db
  .prepare(
    `SELECT f.id, f.code, f.status, f.job_id, j.status AS job_status
     FROM files f
     LEFT JOIN jobs j ON j.id = f.job_id
     WHERE f.status IN ('scraping','scraped','planned','organizing')
     ORDER BY f.id DESC
     LIMIT 20`,
  )
  .all();
console.log("inflight sample:", JSON.stringify(inflight, null, 2));

const activeJobs = db
  .prepare(
    `SELECT id, status, mode, created_at, updated_at FROM jobs
     WHERE status IN ('running','queued')
     ORDER BY created_at DESC LIMIT 10`,
  )
  .all();
console.log("active jobs:", JSON.stringify(activeJobs, null, 2));
