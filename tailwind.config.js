/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['bg', 'side', 'surface', 'surface-2', 'card', 'border', 'line-2', 'text', 'muted', 'faint', 'champ', 'primary', 'primary-soft', 'accent', 'accent-ink', 'gold', 'pos', 'danger', 'warn'].map((t) => [
          t,
          // color-mix i.p.v. var(): zo werken ook klassen met doorzichtigheid (bg-card/90, bg-danger/15).
          `color-mix(in srgb, var(--${t}) calc(<alpha-value> * 100%), transparent)`,
        ]),
      ),
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      borderRadius: { card: 'var(--radius)' },
    },
  },
  plugins: [],
};
