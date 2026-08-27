import type { HealthInfo } from "../types/index.js";
import { api } from "./client.js";

export function fetchHealth() {
  return api<HealthInfo>("/health");
}
