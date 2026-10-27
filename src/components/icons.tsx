import {
  Baby,
  Briefcase,
  Cake,
  Coffee,
  Crown,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Handshake,
  Heart,
  Home,
  MapPin,
  Music,
  PartyPopper,
  Plane,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Iconen die je voor categorieën en gebeurtenistypes kunt kiezen. De naam wordt in de database bewaard.
export const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  home: { icon: Home, label: 'Thuis' },
  heart: { icon: Heart, label: 'Hart' },
  smile: { icon: Smile, label: 'Glimlach' },
  briefcase: { icon: Briefcase, label: 'Werk' },
  user: { icon: User, label: 'Persoon' },
  users: { icon: Users, label: 'Groep' },
  crown: { icon: Crown, label: 'Kroon' },
  handshake: { icon: Handshake, label: 'Handdruk' },
  party: { icon: PartyPopper, label: 'Feest' },
  shuffle: { icon: Shuffle, label: 'Verandering' },
  star: { icon: Star, label: 'Ster' },
  cake: { icon: Cake, label: 'Taart' },
  sparkles: { icon: Sparkles, label: 'Speciaal' },
  plane: { icon: Plane, label: 'Reis' },
  baby: { icon: Baby, label: 'Baby' },
  graduation: { icon: GraduationCap, label: 'School' },
  music: { icon: Music, label: 'Muziek' },
  sport: { icon: Dumbbell, label: 'Sport' },
  coffee: { icon: Coffee, label: 'Koffie' },
  game: { icon: Gamepad2, label: 'Spel' },
  pin: { icon: MapPin, label: 'Plaats' },
};

export function CatIcon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name]?.icon ?? Sparkles;
  return <Icon size={size} className={className} aria-hidden />;
}

export const PALETTE = ['#E9B949', '#F26B1D', '#F5A266', '#6BB8E8', '#8A9590', '#62E3B0', '#C9A7F5', '#F28CB1', '#7FD3E6', '#E46A6A', '#A3C76D', '#D9D2C5'];
