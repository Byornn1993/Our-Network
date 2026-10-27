/** Eigen logo: twee kernen in het midden, met verbindingen naar een kring van mensen. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <circle cx="32" cy="32" r="30" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="1" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        const x = 32 + Math.cos(r) * 21;
        const y = 32 + Math.sin(r) * 21;
        return (
          <g key={a}>
            <line x1="32" y1="32" x2={x} y2={y} stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.2" />
            <circle cx={x} cy={y} r="3" fill="var(--accent)" />
          </g>
        );
      })}
      <circle cx="28.5" cy="32" r="6" fill="var(--gold)" />
      <circle cx="35.5" cy="32" r="6" fill="var(--accent)" fillOpacity="0.9" />
    </svg>
  );
}
