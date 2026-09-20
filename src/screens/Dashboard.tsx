import { useMemo, useState } from 'react';
import {
  Users,
  Mail,
  CalendarCheck,
  Table2,
  Wine,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  Image as ImageIcon,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { useSettings, useInvitations, useGuests, useRsvps, useTables, useBeverages } from '@/hooks/useLiveData';
import { computeStats, tableOccupancy } from '@/lib/stats';
import { generatePoster, downloadPoster } from '@/lib/poster';
import { useToast } from '@/components/ui/Toast';
import type { RouteId } from '@/components/layout/Sidebar';
import type { RsvpStatus } from '@/types';

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold font-display text-ink-800">{value}</p>
          {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate, onPreview }: { onNavigate: (r: RouteId) => void; onPreview: () => void }) {
  const settings = useSettings();
  const invitations = useInvitations();
  const guests = useGuests();
  const rsvps = useRsvps();
  const tables = useTables();
  const beverages = useBeverages();
  const { show } = useToast();

  const [showPoster, setShowPoster] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterFormat, setPosterFormat] = useState<'portrait' | 'square'>('portrait');

  const createPoster = async (format: 'portrait' | 'square') => {
    if (!settings) return;
    setPosterLoading(true);
    try {
      const url = await generatePoster(settings, { format });
      setPosterUrl(url);
      setPosterFormat(format);
      setShowPoster(true);
    } catch {
      show('error', 'Erreur lors de la création du poster.');
    } finally {
      setPosterLoading(false);
    }
  };

  const stats = useMemo(
    () => computeStats(invitations, guests, rsvps, tables, settings?.maxGuests ?? 100),
    [invitations, guests, rsvps, tables, settings]
  );
  const occupancy = useMemo(() => tableOccupancy(tables, guests), [tables, guests]);

  const rsvpPercent = stats.totalInvitations
    ? Math.round(((stats.confirmedCount + stats.declinedCount) / stats.totalInvitations) * 100)
    : 0;
  const attendingVsCap = stats.maxGuestsAllowed
    ? Math.round((stats.totalAttending / stats.maxGuestsAllowed) * 100)
    : 0;

  const recentRsvps = useMemo(() => {
    return [...rsvps]
      .filter((r) => r.status !== 'pending' && r.submittedAt)
      .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      .slice(0, 5);
  }, [rsvps]);

  const invById = useMemo(() => new Map(invitations.map((i) => [i.id, i])), [invitations]);

  const statusLabel: Record<RsvpStatus, string> = {
    confirmed: 'Présent',
    declined: 'Absent',
    pending: 'En attente',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle={settings ? `${settings.brideName} & ${settings.groomName} — ${formatDate(settings.weddingDate)}` : 'Chargement…'}
        icon={<TrendingUp size={22} />}
      />

      {/* Hero banner */}
      {settings && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-800 to-ink-700 p-8 text-white animate-slide-up">
          {settings.heroPhotoDataUrl && (
            <div className="absolute inset-0">
              <img src={settings.heroPhotoDataUrl} alt="" className="h-full w-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-900/80 to-ink-700/60" />
            </div>
          )}
          <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-gold-500/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            {settings.logoDataUrl && (
              <img src={settings.logoDataUrl} alt="Logo" className="h-12 w-12 object-contain shrink-0" />
            )}
            <div>
              <p className="text-gold-300 text-sm font-medium tracking-wider uppercase">Notre mariage</p>
              <h2 className="mt-1 font-display text-4xl text-white">
                {settings.brideName} & {settings.groomName}
              </h2>
            </div>
          </div>
          <div className="relative mt-2">
            <p className="text-ink-200">
              {formatDate(settings.weddingDate)}
              {settings.venueName && ` — ${settings.venueName}`}
            </p>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-6">
              <div>
                <p className="text-3xl font-display text-gold-300">{stats.totalAttending}</p>
                <p className="text-xs text-ink-300">personnes attendues</p>
              </div>
              <div>
                <p className="text-3xl font-display text-gold-300">{stats.totalInvitations}</p>
                <p className="text-xs text-ink-300">invitations</p>
              </div>
              <div>
                <p className="text-3xl font-display text-gold-300">{rsvpPercent}%</p>
                <p className="text-xs text-ink-300">réponses reçues</p>
              </div>
              <div className="ml-auto self-end flex gap-2">
                <button
                  onClick={() => createPoster('portrait')}
                  disabled={posterLoading || !settings}
                  className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-gold-600 disabled:opacity-50"
                >
                  <ImageIcon size={18} /> {posterLoading ? 'Création…' : 'Créer poster'}
                </button>
                <button onClick={onPreview} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20">
                  <Eye size={18} /> Aperçu
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Invitations"
          value={stats.totalInvitations}
          sub={`${stats.totalPeopleAuthorized} personnes autorisées`}
          icon={<Mail size={22} />}
          accent="bg-gold-100 text-gold-600"
        />
        <StatCard
          label="Invités enregistrés"
          value={stats.totalGuestsRegistered}
          sub={`sur ${stats.maxGuestsAllowed} maximum`}
          icon={<Users size={22} />}
          accent="bg-blue-100 text-blue-600"
        />
        <StatCard
          label="Confirmer / Refusés"
          value={`${stats.confirmedCount} / ${stats.declinedCount}`}
          sub={`${stats.pendingCount} en attente`}
          icon={<CalendarCheck size={22} />}
          accent="bg-sage-500/20 text-sage-600"
        />
        <StatCard
          label="Tables"
          value={stats.tablesCount}
          sub={`${stats.totalCapacity} places — ${stats.seatedCount} attribuées`}
          icon={<Table2 size={22} />}
          accent="bg-blush-400/30 text-blush-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* RSVP progress */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-ink-800 mb-4">Suivi des réponses</h3>
          <div className="space-y-4">
            <ProgressBar label="Présents" value={stats.confirmedCount} total={stats.totalInvitations} color="bg-sage-500" icon={<CheckCircle2 size={16} />} />
            <ProgressBar label="Absents" value={stats.declinedCount} total={stats.totalInvitations} color="bg-red-400" icon={<XCircle size={16} />} />
            <ProgressBar label="En attente" value={stats.pendingCount} total={stats.totalInvitations} color="bg-ink-300" icon={<Clock size={16} />} />
          </div>
          <div className="mt-5 pt-5 border-t border-ink-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Personnes attendues vs capacité max</span>
              <span className="font-medium text-ink-700">{stats.totalAttending} / {stats.maxGuestsAllowed}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${attendingVsCap > 90 ? 'bg-red-400' : 'bg-gold-500'}`} style={{ width: `${Math.min(100, attendingVsCap)}%` }} />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-800 mb-4">Accès rapide</h3>
          <div className="space-y-2">
            <QuickLink label="Ajouter une invitation" icon={<Mail size={18} />} onClick={() => onNavigate('invitations')} />
            <QuickLink label="Enregistrer un RSVP" icon={<CalendarCheck size={18} />} onClick={() => onNavigate('rsvp')} />
            <QuickLink label="Gérer les tables" icon={<Table2 size={18} />} onClick={() => onNavigate('tables')} />
            <QuickLink label="Plan de salle" icon={<ArrowRight size={18} />} onClick={() => onNavigate('floorplan')} />
            <QuickLink label="Sauvegarder" icon={<Wine size={18} />} onClick={() => onNavigate('backup')} />
          </div>
        </div>
      </div>

      {/* Table occupancy + recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-800 mb-4">Occupation des tables</h3>
          {occupancy.length === 0 ? (
            <p className="text-sm text-ink-400">Aucune table créée. Rendez-vous dans « Tables & Places ».</p>
          ) : (
            <div className="space-y-3">
              {occupancy.slice(0, 6).map((o) => (
                <div key={o.table.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-ink-700">{o.table.name}</span>
                    <span className="text-ink-400">{o.occupied}/{o.table.capacity}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${o.percent >= 100 ? 'bg-red-400' : o.percent >= 80 ? 'bg-gold-500' : 'bg-sage-500'}`}
                      style={{ width: `${Math.min(100, o.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-800 mb-4">RSVP récents</h3>
          {recentRsvps.length === 0 ? (
            <p className="text-sm text-ink-400">Aucune réponse enregistrée pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {recentRsvps.map((r) => {
                const inv = invById.get(r.invitationId);
                return (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-ink-700">{inv?.familyName ?? '—'}</p>
                      <p className="text-xs text-ink-400">{inv?.invitationNumber} · {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('fr-FR') : ''}</p>
                    </div>
                    <span className={r.status === 'confirmed' ? 'badge-green' : 'badge-red'}>
                      {statusLabel[r.status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Beverages quick stat */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink-800">Choix de boissons</h3>
          <button onClick={() => onNavigate('beverages')} className="btn-ghost btn-sm">Gérer →</button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-ink-600"><Wine size={16} className="text-gold-500" /> {beverages.length} boissons disponibles</div>
          <div className="text-ink-300">·</div>
          <div className="text-ink-600">{stats.beverageSelections} sélections enregistrées</div>
        </div>
      </div>

      {/* Poster modal */}
      <Modal
        open={showPoster}
        onClose={() => setShowPoster(false)}
        title="Poster Save the Date"
        subtitle="Téléchargez ou partagez ce poster sur les réseaux sociaux ou imprimez-le"
      >
        <div className="space-y-4">
          {posterUrl && (
            <div className="flex justify-center">
              <img
                src={posterUrl}
                alt="Poster"
                className="rounded-lg border border-ink-100 max-h-[60vh] object-contain shadow-lg"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => downloadPoster(posterUrl, `save-the-date-${posterFormat}.png`)}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Download size={18} /> Télécharger l'image
            </button>
            <button
              onClick={() => createPoster(posterFormat === 'portrait' ? 'square' : 'portrait')}
              disabled={posterLoading}
              className="btn-secondary flex-1"
            >
              {posterLoading ? 'Création…' : posterFormat === 'portrait' ? 'Format carré (Instagram)' : 'Format portrait'}
            </button>
          </div>
          <p className="text-xs text-ink-400 text-center">
            Format : {posterFormat === 'portrait' ? '1080 × 1350 px (portrait)' : '1080 × 1080 px (carré)'} — optimisé pour les réseaux sociaux et l'impression.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function ProgressBar({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: React.ReactNode }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-2 text-ink-600">{icon} {label}</span>
        <span className="text-ink-500">{value} <span className="text-ink-300">({pct}%)</span></span>
      </div>
      <div className="h-2.5 rounded-full bg-ink-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickLink({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-700">
      <span className="text-gold-500">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ArrowRight size={16} className="text-ink-300" />
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}
