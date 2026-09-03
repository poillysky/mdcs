import { useRef } from "react";
import { LazyCover } from "../LazyCover";

type Props = {
  images: string[];
};

export function RecordDetailGallery({ images }: Props) {
  const galleryRef = useRef<HTMLElement | null>(null);

  if (!images.length) return null;

  return (
    <section className="record-detail-gallery" ref={galleryRef}>
      <h2 className="record-detail-gallery-title">画廊</h2>
      <div className="record-detail-gallery-track">
        {images.map((url) => (
          <a
            key={url}
            className="record-detail-gallery-item"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <LazyCover src={url} alt="" className="record-detail-gallery-img" />
          </a>
        ))}
      </div>
    </section>
  );
}
