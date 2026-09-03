import { useEffect, useState } from "react";
import { fetchFileGallery } from "../../../api";
import {
  appendAssetCacheBust,
  resolveGalleryImageSrcs,
} from "../../../lib/metaDisplay";
import type { FileRow, ScrapeMetaView } from "../../../types";

export function useDetailGallery(
  detailId: number,
  file: FileRow | null,
  meta: ScrapeMetaView | null,
) {
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  useEffect(() => {
    setGalleryImages([]);
  }, [detailId]);

  useEffect(() => {
    if (!file) {
      setGalleryImages([]);
      return;
    }
    const fallback = resolveGalleryImageSrcs(meta, file);
    if (!file.id) {
      setGalleryImages(fallback);
      return;
    }
    let cancelled = false;
    void fetchFileGallery(file.id)
      .then((data) => {
        if (cancelled) return;
        const urls = (data.items ?? [])
          .map((item) => item.url)
          .filter(Boolean)
          .map((url) => appendAssetCacheBust(url, file, meta));
        setGalleryImages(urls.length ? urls : fallback);
      })
      .catch(() => {
        if (!cancelled) setGalleryImages(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [file, meta, file?.id, file?.scraped_at, file?.organized_at, file?.file_mtime, meta?.scrapedAt]);

  return { galleryImages };
}
