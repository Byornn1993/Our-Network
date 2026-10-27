import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { DatePrecision } from '@/lib/db/types';
import { monthName, normalizeToPrecision, todayIso } from '@/domain/dates';
import { CatIcon, ICONS, PALETTE } from '@/components/icons';

export function FormSection({ title, children, aside }: { title?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3">
      {(title || aside) && (
        <div className="flex items-center justify-between">
          {title && <h2 className="section-title pb-0">{title}</h2>}
          {aside}
        </div>
      )}
      <div className="card space-y-4 p-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, required, error, children }: { label: ReactNode; hint?: ReactNode; required?: boolean; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-border'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 font-medium transition ${size === 'sm' ? 'min-h-[32px] text-xs' : 'min-h-[38px] text-sm'} ${value === o.value ? 'bg-card text-text shadow ring-1 ring-border' : 'text-muted hover:text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PRECISIONS: { value: DatePrecision; label: string }[] = [
  { value: 'day', label: 'Datum' },
  { value: 'month', label: 'Maand' },
  { value: 'year', label: 'Enkel jaar' },
];

/**
 * Datum met precisie: voor herinneringen van jaren geleden weet je soms enkel het jaar of de maand.
 * Waarde = 'YYYY-MM-DD' (genormaliseerd), of '' als leeg.
 */
export function DateField({
  id,
  value,
  precision,
  onChange,
  withPrecision = true,
  max,
}: {
  id?: string;
  value: string;
  precision: DatePrecision;
  onChange: (value: string, precision: DatePrecision) => void;
  withPrecision?: boolean;
  max?: string;
}) {
  const year = value ? Number(value.slice(0, 4)) : new Date().getFullYear();
  const month = value ? Number(value.slice(5, 7)) : new Date().getMonth() + 1;
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1930 + 2 }, (_, i) => thisYear + 1 - i);
  const set = (y: number, m: number, p: DatePrecision) => onChange(normalizeToPrecision(`${y}-${String(m).padStart(2, '0')}-01`, p), p);
  return (
    <div className="space-y-2">
      {withPrecision && (
        <Segmented
          size="sm"
          value={precision}
          onChange={(p) => onChange(value ? normalizeToPrecision(value, p) : p === 'day' ? '' : normalizeToPrecision(todayIso(), p), p)}
          options={PRECISIONS}
        />
      )}
      {precision === 'day' ? (
        <input id={id} type="date" className="field" value={value} max={max} onChange={(e) => onChange(e.target.value, 'day')} />
      ) : (
        <div className="flex gap-2">
          {precision === 'month' && (
            <select id={id} className="field" value={value ? month : ''} onChange={(e) => set(year, Number(e.target.value), 'month')}>
              {!value && <option value="">Maand</option>}
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
          )}
          <select id={precision === 'year' ? id : undefined} className="field" value={value ? year : ''} onChange={(e) => set(Number(e.target.value), month, precision)}>
            {!value && <option value="">Jaar</option>}
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
      {value && (
        <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" onClick={() => onChange('', precision)}>
          Datum wissen
        </button>
      )}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Kleur ${c}`}
          onClick={() => onChange(c)}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--card)] transition"
          style={{ background: c, boxShadow: value.toLowerCase() === c.toLowerCase() ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined }}
        >
          {value.toLowerCase() === c.toLowerCase() && <Check size={16} className="text-black/70" />}
        </button>
      ))}
      <label className="flex h-9 items-center gap-2 rounded-full border border-border px-3 text-xs text-muted">
        Eigen
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-5 w-6 cursor-pointer bg-transparent" />
      </label>
    </div>
  );
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Object.entries(ICONS).map(([key, { label }]) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`flex aspect-square items-center justify-center rounded-xl border transition ${value === key ? 'border-transparent' : 'border-border text-muted hover:text-text'}`}
          style={value === key ? { background: `${color}26`, color, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
        >
          <CatIcon name={key} size={18} />
        </button>
      ))}
    </div>
  );
}

/** Gekleurd label (categorie, gebeurtenistype). */
export function Badge({ color, icon, children, size = 'md' }: { color: string; icon?: string; children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
      style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {icon && <CatIcon name={icon} size={size === 'sm' ? 11 : 13} />}
      <span className="truncate">{children}</span>
    </span>
  );
}
