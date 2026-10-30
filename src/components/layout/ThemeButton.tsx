import { Sun } from 'lucide-react';
import { usePref, type Prefs } from '@/lib/prefs';
import { toast } from '@/components/ui/Toast';

// Elke tik gaat een stap verder: automatisch → licht → donker → automatisch. Bewaard per toestel.
const NEXT: Record<Prefs['theme'], Prefs['theme']> = { auto: 'light', light: 'dark', dark: 'auto' };
const LABEL: Record<Prefs['theme'], string> = { auto: 'automatisch', light: 'licht', dark: 'donker' };

export function ThemeButton({ className = '', labelClassName = '' }: { className?: string; labelClassName?: string }) {
  const [theme, setTheme] = usePref('theme');
  const cycle = () => {
    const next = NEXT[theme];
    setTheme(next);
    toast(next === 'auto' ? 'Thema: automatisch (zoals je toestel)' : `Thema: ${LABEL[next]}`);
  };
  return (
    <button type="button" onClick={cycle} title={`Thema: ${LABEL[theme]}`} className={`flex min-h-[44px] items-center gap-3 rounded-xl text-sm font-medium text-muted transition duration-150 hover:bg-champ/[.07] hover:text-text ${className}`}>
      <Sun size={20} className="shrink-0" />
      <span className={labelClassName}>Thema: {LABEL[theme]}</span>
    </button>
  );
}
