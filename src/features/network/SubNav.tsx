import { NavLink } from 'react-router-dom';

/** Subnavigatie op mobiel: Netwerk · Our Story · Overzicht (op desktop staan die in de zijbalk). */
export function SubNav() {
  const items = [
    { to: '/netwerk', label: 'Netwerk' },
    { to: '/story', label: 'Our Story' },
    { to: '/dashboard', label: 'Overzicht' },
  ];
  return (
    <nav aria-label="Onderdelen" className="flex gap-1 rounded-full border border-border bg-surface p-1 md:hidden">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          className={({ isActive }) => `flex min-h-[34px] flex-1 items-center justify-center rounded-full text-[13px] font-medium transition ${isActive ? 'bg-accent text-accent-ink' : 'text-muted'}`}
        >
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
