export async function sendRemoteImage(
  res: import("express").Response,
  rawUrl: string,
  ctx?: { pageUrl?: string; sourceId?: string },
): Promise<boolean> {
  try {
    const { fetchBuffer } = await import("../../scrape/network/fetch.js");
    const { cookieForUrl } = await import("../../scrape/network/sourceCookies.js");
    const { resolveCoverImageReferer } = await import("../../scrape/network/imageReferer.js");
    const { downloadFlareProtectedCoverImage } = await import("../../scrape/network/coverDownload.js");
    const referer = resolveCoverImageReferer(rawUrl, ctx);
    let buf =
      (await downloadFlareProtectedCoverImage(rawUrl, {
        pageUrl: ctx?.pageUrl,
        referer,
        sourceId: ctx?.sourceId,
      })) ?? null;
    if (!buf) {
      buf = await fetchBuffer(rawUrl, {
        referer,
        cookie: cookieForUrl(rawUrl, ctx?.sourceId),
      });
    }
    const ext = rawUrl.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpeg";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(buf);
    return true;
  } catch {
    return false;
  }
}
