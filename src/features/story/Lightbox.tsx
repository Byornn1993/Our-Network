import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import type { EventPhoto } from '@/lib/db/types';
import { useSignedUrl } from '@/lib/images';

/** Foto's op volledig scherm: pijltjes, vegen, Esc. */
export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  onEdit,
  captionFor,
}: {
  photos: EventPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onEdit?: (p: EventPhoto) => void;
  captionFor: (p: EventPhoto) => string;
}) {
  const photo = photos[index];
  const url = useSignedUrl(photo?.storage_path);
  const thumb = useSignedUrl(photo?.thumb_path);
  const start = useRef<number | null>(null);
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  });

  if (!photo) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Foto"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        if (start.current === null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) > 60 && photos.length > 1) (dx > 0 ? prev : next)();
      }}
    >
      <div className="flex items-center justify-between p-2 text-white">
        <span className="px-2 text-sm text-white/70">
          {index + 1} / {photos.length}
        </span>
        <div className="flex">
          {onEdit && (
            <button type="button" aria-label="Foto bewerken" className="tap flex items-center justify-center" onClick={() => onEdit(photo)}>
              <Pencil size={20} />
            </button>
          )}
          <button type="button" aria-label="Sluiten" className="tap flex items-center justify-center" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {(url ?? thumb) ? <img src={url ?? thumb!} alt={photo.caption ?? ''} className="max-h-full max-w-full select-none object-contain" draggable={false} /> : <span className="text-sm text-white/60">Laden…</span>}
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Vorige foto" onClick={prev} className="absolute left-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex">
              <ChevronLeft />
            </button>
            <button type="button" aria-label="Volgende foto" onClick={next} className="absolute right-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex">
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      {captionFor(photo) && <p className="p-4 text-center text-sm text-white/85">{captionFor(photo)}</p>}
    </div>,
    document.body,
  );
}
