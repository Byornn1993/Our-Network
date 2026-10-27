import { useState } from 'react';
import { initials } from '@/domain/people';
import { useSignedUrl } from '@/lib/images';

/** Ronde profielfoto met gekleurde rand; initialen als er (nog) geen foto is of offline. */
export function Avatar({
  path,
  name,
  size = 44,
  color,
  ring = true,
  className = '',
  muted,
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
  color?: string;
  ring?: boolean;
  className?: string;
  muted?: boolean;
}) {
  const url = useSignedUrl(path);
  const [failed, setFailed] = useState<string | null>(null);
  const show = url && failed !== url;
  const border = ring ? Math.max(2, Math.round(size / 22)) : 0;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold text-muted ${muted ? 'opacity-60 grayscale' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        boxShadow: ring && color ? `0 0 0 ${border}px ${color}` : undefined,
      }}
      aria-hidden
    >
      {show ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(url)} draggable={false} /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ items, size = 26, max = 4 }: { items: { id: string; path: string | null; name: string; color?: string }[]; size?: number; max?: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} className="rounded-full ring-2 ring-[var(--card)]" style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar path={p.path} name={p.name} size={size} color={p.color} ring={false} />
        </span>
      ))}
      {rest > 0 && <span className="ml-1.5 text-xs text-muted">+{rest}</span>}
    </span>
  );
}
