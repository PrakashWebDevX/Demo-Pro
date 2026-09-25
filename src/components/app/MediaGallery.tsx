import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";
import type { ReportMediaItem } from "@/lib/reports";

/** Responsive evidence gallery with click-to-enlarge images and a simple video player. */
export function MediaGallery({
  media,
  publicId,
  className,
}: {
  media: ReportMediaItem[];
  publicId: string;
  className?: string;
}) {
  const { tr } = useLang();
  const [open, setOpen] = useState<number | null>(null);
  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");
  const altFor = (i: number) => tr("Evidence image {n} for report {id}", undefined, { n: i + 1, id: publicId });
  const active = open !== null ? images[open] : undefined;

  return (
    <div className={className}>
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block w-full overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={m.url}
                  alt={altFor(i)}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {videos.map((v) => (
        <video
          key={v.id}
          src={v.url}
          controls
          preload="metadata"
          controlsList="nodownload"
          aria-label={tr("Evidence video for report {id}", undefined, { id: publicId })}
          className="mt-3 max-h-80 w-full rounded-md bg-muted"
        />
      ))}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl p-2 sm:p-4">
          <DialogTitle className="sr-only">{active && open !== null ? altFor(open) : ""}</DialogTitle>
          {active && open !== null ? (
            <img src={active.url} alt={altFor(open)} className="max-h-[80vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
