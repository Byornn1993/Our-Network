import { Link } from 'react-router-dom';
import { BookHeart, Cake, CalendarPlus, ChevronRight, Sparkles, UserPlus, Users } from 'lucide-react';
import { useStore } from '@/lib/db/store';
import { activePersons, networkStats } from '@/domain/stats';
import { globalTimeline } from '@/domain/timeline';
import { daysUntilBirthday, ageOn, formatDate, relativeDays } from '@/domain/dates';
import { fullName } from '@/domain/people';
import { Avatar } from '@/components/Avatar';
import { CatIcon } from '@/components/icons';
import { SubNav } from '@/features/network/SubNav';
import { TimelineEntry } from '@/features/story/TimelineList';

/** Donutdiagram (SVG) van de verdeling over categorieën. */
function Donut({ parts, total }: { parts: { id: string; color: string; count: number }[]; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label={`${total} personen`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
      {total > 0 &&
        parts
          .filter((p) => p.count > 0)
          .map((p) => {
            const len = (p.count / total) * c;
            const el = (
              <circle
                key={p.id}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      <text x="70" y="68" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--text)">
        {total}
      </text>
      <text x="70" y="88" textAnchor="middle" fontSize="11" fill="var(--muted)">
        personen
      </text>
    </svg>
  );
}

function StatCard({ label, value, color, icon, to }: { label: string; value: number; color?: string; icon?: React.ReactNode; to?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: color ? `${color}22` : 'var(--primary-soft)', color: color ?? 'var(--accent)' }}>
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">{value}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card block p-4 transition hover:border-accent/40">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export default function DashboardPage() {
  const s = useStore();
  const st = networkStats(s);
  const recent = globalTimeline(s, { includeChanges: false }).slice(0, 4);
  const latest = [...activePersons(s)].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const birthdays = activePersons(s)
    .filter((p) => p.birth_date)
    .map((p) => ({ p, days: daysUntilBirthday(p.birth_date!) }))
    .filter((x) => x.days <= 45)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  const [b, stp] = [s.profiles[0], s.profiles[1]];

  return (
    <div className="px-4 pb-8 pt-4 md:px-0">
      <SubNav />
      <header className="mt-3 flex items-center gap-3 md:mt-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-3xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted">Een overzicht van ons netwerk</p>
        </div>
        <div className="flex items-center">
          {b && <Avatar path={b.avatar_path} name={b.name} size={40} color="var(--gold)" />}
          {stp && (
            <span className="-ml-3">
              <Avatar path={stp.avatar_path} name={stp.name} size={40} color="var(--accent)" />
            </span>
          )}
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Totaal personen" value={st.total} icon={<Users size={14} />} to="/personen" />
        {st.byCategory.map((c) => {
          const cat = s.categoryById.get(c.id)!;
          return <StatCard key={c.id} label={c.name} value={c.count} color={c.color} icon={<CatIcon name={cat.icon} size={14} />} />;
        })}
        <StatCard label="Gemeenschappelijk" value={st.common} icon={<Sparkles size={14} />} />
        <StatCard label={`Contacten van ${b?.name ?? 'Bjorn'}`} value={st.bjorn} color="#E9B949" icon={<Users size={14} />} />
        <StatCard label={`Contacten van ${stp?.name ?? 'Stephanie'}`} value={st.stephanie} color="#62E3B0" icon={<Users size={14} />} />
        <StatCard label="Nieuwe personen dit jaar" value={st.newPersonsThisYear} icon={<UserPlus size={14} />} />
        <StatCard label="Momenten dit jaar" value={st.newEventsThisYear} icon={<CalendarPlus size={14} />} to={`/story/jaar/${new Date().getFullYear()}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-[15px] font-semibold">Verdeling netwerk</h2>
          <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
            <Donut parts={st.byCategory} total={st.total} />
            <ul className="w-full space-y-2">
              {st.byCategory.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1">{c.name}</span>
                  <span className="tabular-nums text-muted">{c.count}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-faint">{st.total ? Math.round((c.count / st.total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Recente momenten</h2>
            <Link to="/story" className="flex items-center text-sm text-accent hover:underline">
              Our Story <ChevronRight size={15} />
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {recent.length ? (
              recent.map((it) => <TimelineEntry key={it.key} item={it} />)
            ) : (
              <p className="text-sm text-muted">
                Nog geen momenten.{' '}
                <Link to="/story/nieuw" className="text-accent hover:underline">
                  Voeg er een toe
                </Link>
              </p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-[15px] font-semibold">Laatst toegevoegd</h2>
          <ul className="mt-2 divide-y divide-border">
            {latest.length === 0 && <li className="py-2 text-sm text-muted">Nog niemand toegevoegd.</li>}
            {latest.map((p) => {
              const c = s.categoryById.get(p.category_id);
              return (
                <li key={p.id}>
                  <Link to={`/personen/${p.id}`} className="flex items-center gap-3 py-2">
                    <Avatar path={p.avatar_path} name={fullName(p)} size={36} color={c?.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{fullName(p)}</span>
                      <span className="block text-xs text-muted">
                        {relativeDays(p.created_at)} · {c?.name}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Cake size={16} className="text-[#F28CB1]" /> Verjaardagen
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {birthdays.length === 0 && <li className="py-2 text-sm text-muted">Geen verjaardagen in de komende weken (of nog geen geboortedata ingevuld).</li>}
            {birthdays.map(({ p, days }) => (
              <li key={p.id}>
                <Link to={`/personen/${p.id}`} className="flex items-center gap-3 py-2">
                  <Avatar path={p.avatar_path} name={fullName(p)} size={36} color={s.categoryById.get(p.category_id)?.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{fullName(p)}</span>
                    <span className="block text-xs text-muted">
                      {formatDate(p.birth_date!).replace(/ \d{4}$/, '')} · wordt {ageOn(p.birth_date!) + (days === 0 ? 0 : 1)}
                    </span>
                  </span>
                  <span className={`text-xs ${days === 0 ? 'font-semibold text-accent' : 'text-muted'}`}>{days === 0 ? 'Vandaag!' : `over ${days} d`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Link to={`/story/jaar/${new Date().getFullYear()}`} className="card mt-4 flex items-center gap-3 p-4 transition hover:border-accent/40">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-accent">
          <BookHeart size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Ons jaar in beeld</span>
          <span className="block text-sm text-muted">Het jaaroverzicht van {new Date().getFullYear()}</span>
        </span>
        <ChevronRight size={18} className="text-faint" />
      </Link>
    </div>
  );
}
