import { initials } from '@/domain/people';
import { useSignedUrl } from '@/lib/images';

/** Ronde profielfoto (of initialen) in SVG, met gekleurde rand; voor de netwerkkaart. */
export function SvgAvatar({ id, path, name, size, color, x = 0, y = 0, glow }: { id: string; path: string | null; name: string; size: number; color: string; x?: number; y?: number; glow?: boolean }) {
  const url = useSignedUrl(path);
  const r = size / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow && <circle r={r + 6} fill={color} opacity={0.18} />}
      <circle r={r} fill="var(--surface-2)" />
      {url ? (
        <>
          <clipPath id={`clip-${id}`}>
            <circle r={r} />
          </clipPath>
          <image href={url} x={-r} y={-r} width={size} height={size} clipPath={`url(#clip-${id})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.36} fontWeight={600} fill="var(--muted)">
          {initials(name)}
        </text>
      )}
      <circle r={r} fill="none" stroke={color} strokeWidth={Math.max(2, size / 18)} />
    </g>
  );
}
