/** Doorzichtige variant van een kleur; werkt voor hex-codes én CSS-variabelen (var(--accent)). */
export function tint(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
