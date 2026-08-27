import type { KindId, LibrariesConfig, OrganizeFallback, OrganizeMode, OnConflict } from "../types.js";
import { KIND_IDS } from "../types.js";
import { defaultOrganizeConfig } from "./organizeDefaults.js";

export const KIND_LABELS: Record<KindId, string> = {
  japan_censored: "日本有码",
  japan_gravure: "日本写真",
  japan_uncensored: "日本无码",
  japan_amateur: "日本素人",
  fc2: "FC2",
  china: "国产无码",
  western: "欧美无码",
};

export type ServerWebConfig = {
  server: { port: number; host: string };
  web: { port: number; apiOrigin: string };
};

export const DEFAULT_SERVER_WEB: ServerWebConfig = {
  server: { port: 9210, host: "0.0.0.0" },
  web: { port: 3050, apiOrigin: "http://127.0.0.1:9210" },
};

export function defaultLibrariesConfig(): LibrariesConfig & ServerWebConfig {
  return {
    pathRoot: ".",
    indexRoot: "index",
    organize: defaultOrganizeConfig(),
    ...DEFAULT_SERVER_WEB,
    kinds: Object.fromEntries(
      KIND_IDS.map((id) => [
        id,
        {
          enabled: true,
          label: KIND_LABELS[id],
          sourceRoot: "",
          libraryRoot: "",
        },
      ]),
    ) as LibrariesConfig["kinds"],
  };
}

export const ORGANIZE_MODES: OrganizeMode[] = [
  "hardlink",
  "softlink",
  "inplace",
  "copy",
  "move",
];
export const ORGANIZE_FALLBACKS: OrganizeFallback[] = ["copy", "fail"];
export const ON_CONFLICT: OnConflict[] = ["skip", "overwrite", "rename"];
