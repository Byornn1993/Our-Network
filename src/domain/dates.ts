import { differenceInYears, format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { DatePrecision } from '@/lib/db/types';

// Datums zonder tijd worden als 'YYYY-MM-DD' bewaard. Bij precisie 'month' of 'year'
// staat de dag/maand op 01 en tonen we enkel wat we echt weten ("maart 2019", "2019").

export const todayIso = (d = new Date()): string => format(d, 'yyyy-MM-dd');

export function parseDay(iso: string): Date {
  return parseISO(iso.slice(0, 10));
}

export function formatDate(iso: string | null | undefined, precision: DatePrecision = 'day', style: 'long' | 'short' = 'long'): string {
  if (!iso) return '';
  const d = parseDay(iso);
  if (precision === 'year') return format(d, 'yyyy');
  if (precision === 'month') return format(d, style === 'long' ? 'LLLL yyyy' : 'LLL yyyy', { locale: nl });
  return format(d, style === 'long' ? 'd MMMM yyyy' : 'd MMM yyyy', { locale: nl });
}

export function formatRange(start: string, end: string | null, precision: DatePrecision): string {
  if (!end || end === start) return formatDate(start, precision);
  return `${formatDate(start, precision)} – ${formatDate(end, precision)}`;
}

export const yearOf = (iso: string): number => Number(iso.slice(0, 4));
export const monthOf = (iso: string): number => Number(iso.slice(5, 7));

export const monthName = (m: number, style: 'long' | 'short' = 'long'): string =>
  format(new Date(2000, m - 1, 1), style === 'long' ? 'LLLL' : 'LLL', { locale: nl });

/** Normaliseert een datum naar de gekozen precisie (maand → dag 01, jaar → 01-01). */
export function normalizeToPrecision(iso: string, precision: DatePrecision): string {
  if (precision === 'year') return `${iso.slice(0, 4)}-01-01`;
  if (precision === 'month') return `${iso.slice(0, 7)}-01`;
  return iso.slice(0, 10);
}

/** "16 jaar", "3 maanden", "minder dan een maand" — hoe lang iemand al in ons leven is. */
export function durationSince(iso: string, now = new Date()): string {
  const d = parseDay(iso);
  const years = differenceInYears(now, d);
  if (years >= 1) return `${years} jaar`;
  const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
  if (months >= 1) return `${months} ${months === 1 ? 'maand' : 'maanden'}`;
  return 'minder dan een maand';
}

export function ageOn(birth: string, now = new Date()): number {
  return differenceInYears(now, parseDay(birth));
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Verjaardag in een bepaald jaar. Wie op 29 februari jarig is, viert in een gewoon jaar op 28 februari. */
function birthdayIn(year: number, b: Date): Date {
  const leapDay = b.getMonth() === 1 && b.getDate() === 29;
  return new Date(year, b.getMonth(), leapDay && !isLeap(year) ? 28 : b.getDate());
}

/** Aantal dagen tot de volgende verjaardag (0 = vandaag). */
export function daysUntilBirthday(birth: string, now = new Date()): number {
  const b = parseDay(birth);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = birthdayIn(today.getFullYear(), b);
  if (next < today) next = birthdayIn(today.getFullYear() + 1, b);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDays(iso: string, now = new Date()): string {
  const d = parseDay(iso.slice(0, 10));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'vandaag';
  if (diff === 1) return 'gisteren';
  if (diff < 7) return `${diff} dagen geleden`;
  if (diff < 31) return `${Math.floor(diff / 7)} ${Math.floor(diff / 7) === 1 ? 'week' : 'weken'} geleden`;
  return formatDate(iso, 'day', 'short');
}
