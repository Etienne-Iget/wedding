import { type ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Settings,
  Mail,
  Users,
  CalendarCheck,
  Table2,
  Wine,
  LayoutGrid,
  DatabaseBackup,
  Heart,
  Menu,
  X,
  CloudOff,
  ScanLine,
} from 'lucide-react';

export type RouteId =
  | 'dashboard'
  | 'settings'
  | 'invitations'
  | 'guests'
  | 'rsvp'
  | 'arrivals'
  | 'tables'
  | 'beverages'
  | 'floorplan'
  | 'backup';

interface NavItem {
  id: RouteId;
  label: string;
  icon: ReactNode;
  group: 'plan' | 'invites' | 'logistique' | 'systeme';
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, group: 'plan' },
  { id: 'settings', label: 'Paramètres', icon: <Settings size={20} />, group: 'plan' },
  { id: 'invitations', label: 'Invitations', icon: <Mail size={20} />, group: 'invites' },
  { id: 'guests', label: 'Invités', icon: <Users size={20} />, group: 'invites' },
  { id: 'rsvp', label: 'RSVP (local)', icon: <CalendarCheck size={20} />, group: 'invites' },
  { id: 'arrivals', label: 'Arrivées (Scan)', icon: <ScanLine size={20} />, group: 'invites' },
  { id: 'tables', label: 'Tables & Places', icon: <Table2 size={20} />, group: 'logistique' },
  { id: 'beverages', label: 'Boissons', icon: <Wine size={20} />, group: 'logistique' },
  { id: 'floorplan', label: 'Plan de salle', icon: <LayoutGrid size={20} />, group: 'logistique' },
  { id: 'backup', label: 'Sauvegarde', icon: <DatabaseBackup size={20} />, group: 'systeme' },
];

const groupLabels: Record<NavItem['group'], string> = {
  plan: 'Planning',
  invites: 'Invités',
  logistique: 'Logistique',
  systeme: 'Système',
};

interface SidebarProps {
  current: RouteId;
  onNavigate: (id: RouteId) => void;
  coupleNames: string;
  weddingDate: string;
  logoSrc?: string | null;
}

export function Sidebar({ current, onNavigate, coupleNames, weddingDate, logoSrc }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const close = () => setMobileOpen(false);

  useEffect(() => {
    close();
  }, [current]);

  const groups: NavItem['group'][] = ['plan', 'invites', 'logistique', 'systeme'];

  const content = (
    <div className="flex h-full flex-col bg-ink-800 text-ink-100">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/20 text-gold-300 shrink-0 overflow-hidden">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <Heart size={20} fill="currentColor" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg text-white truncate">{coupleNames}</p>
          <p className="text-xs text-ink-300 truncate">{weddingDate}</p>
        </div>
        <button onClick={close} className="ml-auto btn-icon text-ink-300 hover:text-white lg:hidden">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {groupLabels[g]}
            </p>
            <div className="space-y-0.5">
              {navItems
                .filter((n) => n.group === g)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onNavigate(n.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      current === n.id
                        ? 'bg-gold-500 text-white shadow-soft'
                        : 'text-ink-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {n.icon}
                    <span>{n.label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Offline badge */}
      <div className="border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-ink-300">
          <CloudOff size={14} />
          <span>100% local — fonctionne hors ligne</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-ink-800 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="h-6 w-6 object-contain" />
          ) : (
            <Heart size={18} className="text-gold-400" fill="currentColor" />
          )}
          <span className="font-display text-base">{coupleNames}</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="btn-icon text-white hover:bg-white/10">
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-20">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in" onClick={close} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] animate-slide-up">{content}</div>
        </div>
      )}
    </>
  );
}
