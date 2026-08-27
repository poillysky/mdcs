import type { IndexBrowse, KindRow, OrganizeConfig } from "../types/index.js";
import { api } from "./client.js";

export function fetchKinds() {
  return api<{ organize: OrganizeConfig; indexRoot: string; kinds: KindRow[] }>("/api/kinds");
}

export function fetchIndexFolders(parent = "") {
  const q = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return api<IndexBrowse>(`/api/kinds/folders${q}`);
}

export function updateKind(
  kindId: string,
  patch: Partial<{
    enabled: boolean;
    label: string;
    sourceRoot: string;
    libraryRoot: string;
    organizeMode: string;
    organizeFallback: string;
    useGlobalOrganize: boolean;
    metadataDir: string;
    deleteMetadataOnFail: boolean;
  }>,
) {
  return api<{ kind: KindRow; stats: Record<string, number> }>(
    `/api/kinds/${encodeURIComponent(kindId)}`,
    { method: "PUT", body: JSON.stringify(patch) },
  );
}

export function updateOrganizeConfig(patch: Partial<OrganizeConfig>) {
  return api<{ organize: OrganizeConfig }>("/api/kinds/organize", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function scanKind(kindId: string) {
  return api(`/api/kinds/${encodeURIComponent(kindId)}/scan`, { method: "POST" });
}
