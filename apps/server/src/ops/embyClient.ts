/** Emby REST 客户端（演员同步用） */

export type EmbyClientOptions = {
  baseUrl: string;
  apiKey: string;
  userId?: string;
  signal?: AbortSignal;
};

export type EmbyLibrary = { id: string; name: string };

export type EmbyPerson = {
  id: string;
  name: string;
  overview?: string;
  hasPrimaryImage: boolean;
  providerIds?: Record<string, string>;
  premiereDate?: string;
  productionLocations?: string[];
};

function normalizeBaseUrl(raw: string): string {
  let u = String(raw || "").trim();
  if (!u) throw new Error("Emby 地址为空");
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  u = u.replace(/\/+$/, "");
  // 去掉末尾 /emby，统一再拼前缀
  u = u.replace(/\/emby$/i, "");
  return u;
}

export function buildEmbyApiUrl(baseUrl: string, path: string, query?: Record<string, string | undefined>): string {
  const root = normalizeBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;
  const withPrefix = p.startsWith("/emby/") || p === "/emby" ? p : `/emby${p}`;
  const url = new URL(`${root}${withPrefix}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export function embyAuthHeaders(apiKey: string, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Authorization", `MediaBrowser Token="${apiKey}"`);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  return h;
}

async function embyFetch<T = unknown>(
  opts: EmbyClientOptions,
  path: string,
  init: RequestInit & { query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { apiKey, signal } = opts;
  if (!apiKey.trim()) throw new Error("Emby API Key 为空");
  const url = buildEmbyApiUrl(opts.baseUrl, path, init.query);
  const headers = embyAuthHeaders(apiKey, init.headers);
  const res = await fetch(url, { ...init, headers, signal: init.signal ?? signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Emby ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export async function testEmbyConnection(opts: EmbyClientOptions): Promise<{ serverName: string; version: string }> {
  const info = await embyFetch<{ ServerName?: string; Version?: string }>(opts, "/System/Info");
  return {
    serverName: info.ServerName || "Emby",
    version: info.Version || "",
  };
}

export async function listEmbyLibraries(opts: EmbyClientOptions): Promise<EmbyLibrary[]> {
  const data = await embyFetch<{ Items?: Array<{ Id?: string; Name?: string }> }>(
    opts,
    "/Library/MediaFolders",
  );
  return (data.Items || [])
    .filter((x) => x.Id && x.Name)
    .map((x) => ({ id: String(x.Id), name: String(x.Name) }));
}

type RawPerson = {
  Id?: string;
  Name?: string;
  Overview?: string;
  ImageTags?: { Primary?: string };
  ProviderIds?: Record<string, string>;
  PremiereDate?: string;
  ProductionLocations?: string[];
};

function mapPerson(p: RawPerson): EmbyPerson | null {
  if (!p.Id || !p.Name) return null;
  return {
    id: String(p.Id),
    name: String(p.Name),
    overview: p.Overview || "",
    hasPrimaryImage: Boolean(p.ImageTags?.Primary),
    providerIds: p.ProviderIds || {},
    premiereDate: p.PremiereDate,
    productionLocations: p.ProductionLocations,
  };
}

/** 全库演员（Persons） */
export async function listEmbyPersons(opts: EmbyClientOptions): Promise<EmbyPerson[]> {
  const query: Record<string, string | undefined> = {
    personTypes: "Actor",
    Fields: "Overview,ProviderIds,PremiereDate,ProductionLocations",
  };
  if (opts.userId?.trim()) query.userId = opts.userId.trim();
  const data = await embyFetch<{ Items?: RawPerson[] }>(opts, "/Persons", { query });
  return (data.Items || []).map(mapPerson).filter((x): x is EmbyPerson => Boolean(x));
}

/**
 * 从指定媒体库影片的 People 收集演员；
 * recentDays>0 时用 DateCreated 本地过滤。
 */
export async function collectActorsFromLibraries(
  opts: EmbyClientOptions,
  libraryIds: string[],
  recentDays = 0,
): Promise<EmbyPerson[]> {
  const byId = new Map<string, EmbyPerson>();
  const cutoff =
    recentDays > 0 ? Date.now() - recentDays * 24 * 60 * 60 * 1000 : 0;

  for (const libId of libraryIds) {
    const query: Record<string, string | undefined> = {
      Recursive: "true",
      Fields: "People,DateCreated",
      ParentId: libId,
      IncludeItemTypes: "Movie,Series,Episode",
    };
    if (opts.userId?.trim()) query.UserId = opts.userId.trim();
    const data = await embyFetch<{
      Items?: Array<{
        DateCreated?: string;
        People?: Array<{ Id?: string; Name?: string; Type?: string; PrimaryImageTag?: string }>;
      }>;
    }>(opts, "/Items", { query });

    for (const item of data.Items || []) {
      if (cutoff && item.DateCreated) {
        const t = Date.parse(item.DateCreated);
        if (Number.isFinite(t) && t < cutoff) continue;
      }
      for (const pe of item.People || []) {
        if (!pe.Id || !pe.Name) continue;
        if (pe.Type && pe.Type !== "Actor") continue;
        if (byId.has(pe.Id)) continue;
        byId.set(pe.Id, {
          id: pe.Id,
          name: pe.Name,
          overview: "",
          hasPrimaryImage: Boolean(pe.PrimaryImageTag),
        });
      }
    }
  }

  const out: EmbyPerson[] = [];
  for (const rough of byId.values()) {
    try {
      const full = await embyFetch<RawPerson>(opts, `/Items/${rough.id}`, {
        query: { Fields: "Overview,ProviderIds,PremiereDate,ProductionLocations" },
      });
      out.push(mapPerson({ ...full, Id: rough.id, Name: rough.name }) || rough);
    } catch {
      out.push(rough);
    }
  }
  return out;
}

export async function updateEmbyPerson(
  opts: EmbyClientOptions,
  personId: string,
  patch: {
    name?: string;
    overview?: string;
    premiereDate?: string;
    productionLocations?: string[];
    providerIds?: Record<string, string>;
  },
): Promise<void> {
  const current = await embyFetch<Record<string, unknown>>(opts, `/Items/${personId}`, {
    query: { Fields: "Overview,ProviderIds,PremiereDate,ProductionLocations" },
  });
  const body = {
    ...current,
    Name: patch.name ?? current.Name,
    Overview: patch.overview ?? current.Overview,
    PremiereDate: patch.premiereDate ?? current.PremiereDate,
    ProductionLocations: patch.productionLocations ?? current.ProductionLocations,
    ProviderIds: { ...(current.ProviderIds as object || {}), ...(patch.providerIds || {}) },
  };
  await embyFetch(opts, `/Items/${personId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 上传 Primary 头像（JPEG/PNG bytes → base64） */
export async function uploadEmbyPersonPrimaryImage(
  opts: EmbyClientOptions,
  personId: string,
  imageBytes: Buffer,
  contentType = "image/jpeg",
): Promise<void> {
  const b64 = imageBytes.toString("base64");
  await embyFetch(opts, `/Items/${personId}/Images/Primary`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: b64,
  });
}

export async function refreshEmbyLibrary(
  opts: EmbyClientOptions,
  libraryIds?: string[],
): Promise<void> {
  if (libraryIds?.length) {
    for (const id of libraryIds) {
      await embyFetch(opts, `/Items/${id}/Refresh`, {
        method: "POST",
        query: {
          Recursive: "true",
          ImageRefreshMode: "Default",
          MetadataRefreshMode: "Default",
        },
      }).catch(() => undefined);
    }
    return;
  }
  await embyFetch(opts, "/Library/Refresh", { method: "POST" });
}

export function createEmbyClientFromActorsConfig(actors: {
  embyUrl: string;
  embyApiKey: string;
  embyUserId?: string;
}, signal?: AbortSignal): EmbyClientOptions {
  return {
    baseUrl: actors.embyUrl,
    apiKey: actors.embyApiKey,
    userId: actors.embyUserId || "",
    signal,
  };
}
