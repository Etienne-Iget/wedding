import { useEffect, useState } from 'react';
import { Heart, MapPin, Clock, Calendar, Check, X, Minus, Wine } from 'lucide-react';
import { useSettings, useInvitations, useGuests, useRsvps, useBeverages } from '@/hooks/useLiveData';
import { useStore } from '@/store/StoreContext';
import type { WeddingEvent, RsvpStatus } from '@/types';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(t: string): string {
  if (!t) return '';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, '0');
  if (isNaN(h) || h < 0 || h > 23) h = 0;
  return `${String(h).padStart(2, '0')}h${m}`;
}

function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ClientPreview({ onClose, inviteToken }: { onClose: () => void; inviteToken?: string | null }) {
  const settings = useSettings();
  const invitations = useInvitations();
  const guests = useGuests();
  const rsvps = useRsvps();
  const beverages = useBeverages();
  const { upsertRsvp, addGuest, updateGuest } = useStore();

  const [search, setSearch] = useState('');
  const [foundInv, setFoundInv] = useState<string | null>(null);
  const [status, setStatus] = useState<RsvpStatus>('pending');
  const [attendingCount, setAttendingCount] = useState(1);
  const [note, setNote] = useState('');
  const [people, setPeople] = useState<{ firstName: string; beverageId: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const rsvpByInv = new Map(rsvps.map((r) => [r.invitationId, r]));
  const invGuests = foundInv ? guests.filter((g) => g.invitationId === foundInv) : [];

  // Auto-select invitation from URL token (?invite=TOKEN)
  useEffect(() => {
    if (inviteToken && invitations.length > 0 && !foundInv) {
      const match = invitations.find(
        (i) => i.qrToken === inviteToken || i.invitationNumber === inviteToken
      );
      if (match) {
        setFoundInv(match.id);
        setSearch(match.invitationNumber);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken, invitations]);

  useEffect(() => {
    if (foundInv) {
      const existing = rsvpByInv.get(foundInv);
      setStatus(existing?.status ?? 'pending');
      setAttendingCount(existing?.attendingCount ?? 1);
      setNote(existing?.note ?? '');
      const ig = guests.filter((g) => g.invitationId === foundInv);
      setPeople(ig.map((g) => ({ firstName: g.firstName, beverageId: g.beverageId ?? '' })));
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundInv]);

  const searchResults = search.trim()
    ? invitations.filter(
        (i) =>
          i.invitationNumber.toLowerCase().includes(search.trim().toLowerCase()) ||
          i.familyName.toLowerCase().includes(search.trim().toLowerCase())
      ).slice(0, 5)
    : [];

  const selectInv = (id: string) => {
    setFoundInv(id);
    const inv = invitations.find((i) => i.id === id);
    if (inv) setSearch(inv.invitationNumber);
  };

  const submitRsvp = () => {
    if (!foundInv) return;
    const now = Date.now();
    const existing = rsvpByInv.get(foundInv);
    const inv = invitations.find((i) => i.id === foundInv);
    upsertRsvp({
      id: existing?.id ?? foundInv,
      invitationId: foundInv,
      status,
      attendingCount: status === 'confirmed' ? attendingCount : 0,
      submittedAt: existing?.submittedAt ?? now,
      note: note || null,
      updatedAt: now,
    });

    for (const p of people) {
      const existingGuest = invGuests.find((g) => g.firstName === p.firstName);
      if (existingGuest) {
        updateGuest({
          ...existingGuest,
          beverageId: p.beverageId || null,
          beverageQuantity: p.beverageId ? 1 : null,
          updatedAt: now,
        });
      } else if (p.firstName.trim()) {
        addGuest({
          id: crypto.randomUUID(),
          invitationId: foundInv,
          firstName: p.firstName.trim(),
          lastName: inv?.familyName ?? '',
          tableId: null,
          seatNumber: null,
          beverageId: p.beverageId || null,
          beverageQuantity: p.beverageId ? 1 : null,
          isChild: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    setSubmitted(true);
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-900">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gold-300 border-t-gold-600" />
      </div>
    );
  }

  const ev = settings.events ?? { dot: { date: '', time: '', venueName: '', venueAddress: '' }, civil: { date: '', time: '', venueName: '', venueAddress: '' }, religious: { date: '', time: '', venueName: '', venueAddress: '' } };
  const countdown = daysUntil(settings.weddingDate);
  const heroImage = settings.heroPhotoSrc;
  const logo = settings.logoSrc;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-900">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition-colors hover:bg-white/20"
      >
        <X size={18} /> Quitter l'aperçu
      </button>

      {/* Hero section */}
      <div className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {heroImage ? (
            <img src={heroImage} alt="Couple" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-ink-800 via-ink-900 to-ink-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/40 via-ink-900/60 to-ink-900/90" />
        </div>

        <div className="relative z-10 text-center px-6 animate-fade-in">
          {logo && (
            <img src={logo} alt="Logo" className="mx-auto h-20 w-20 object-contain mb-6" />
          )}
          <p className="text-gold-300 text-sm font-medium tracking-[0.3em] uppercase mb-4">Nous nous marions</p>
          <h1 className="font-display text-5xl sm:text-7xl text-white leading-tight">
            {settings.brideName}
          </h1>
          <div className="my-4 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-gold-400" />
            <Heart size={24} className="text-gold-400" fill="currentColor" />
            <span className="h-px w-12 bg-gold-400" />
          </div>
          <h1 className="font-display text-5xl sm:text-7xl text-white leading-tight">
            {settings.groomName}
          </h1>

          {countdown !== null && countdown > 0 && (
            <p className="mt-8 text-gold-300 font-display text-2xl">
              Dans {countdown} jours
            </p>
          )}
          {settings.weddingDate && (
            <p className="mt-3 text-ink-200 text-lg">
              {formatDate(settings.weddingDate)}
              {settings.venueName && ` · ${settings.venueName}`}
            </p>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="text-gold-300 text-xs tracking-widest uppercase">Défiler</div>
        </div>
      </div>

      {/* Events section */}
      <div className="bg-cream py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-4xl text-ink-800 mb-2">Le programme</h2>
          <div className="mx-auto h-px w-20 bg-gold-400 mb-12" />

          <div className="space-y-8">
            <EventCard
              title="La Dot"
              event={ev.dot}
              icon={<Heart size={24} className="text-gold-500" />}
            />
            <EventCard
              title="Mariage Civil"
              event={ev.civil}
              icon={<Calendar size={24} className="text-gold-500" />}
            />
            <EventCard
              title="Mariage Religieux"
              event={ev.religious}
              icon={<Heart size={24} className="text-gold-500" fill="currentColor" />}
            />
          </div>
        </div>
      </div>

      {/* RSVP section */}
      <div className="bg-ink-800 py-20 px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-4xl text-white mb-2">Confirmez votre présence</h2>
          <div className="mx-auto h-px w-20 bg-gold-400 mb-12" />

          {!foundInv && !submitted && (
            <div className="space-y-4">
              <p className="text-center text-ink-300 text-sm mb-6">
                Recherchez votre invitation par numéro ou nom de famille.
              </p>
              <input
                className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-ink-400 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
                placeholder="Ex : INV-001 ou Kabeya"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => selectInv(inv.id)}
                      className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                    >
                      <div>
                        <p className="font-mono text-xs text-gold-300">{inv.invitationNumber}</p>
                        <p className="text-white font-medium">{inv.familyName}</p>
                        <p className="text-xs text-ink-400">{inv.maxPeople} personnes autorisées</p>
                      </div>
                      <span className="text-gold-300 text-sm">Sélectionner →</span>
                    </button>
                  ))}
                </div>
              )}
              {search && searchResults.length === 0 && (
                <p className="text-center text-ink-400 text-sm">Aucune invitation trouvée.</p>
              )}
            </div>
          )}

          {foundInv && !submitted && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-mono text-xs text-gold-300">{invitations.find((i) => i.id === foundInv)?.invitationNumber}</p>
                <h3 className="font-display text-2xl text-white">
                  Famille {invitations.find((i) => i.id === foundInv)?.familyName}
                </h3>
                <button onClick={() => { setFoundInv(null); setSearch(''); }} className="mt-2 text-xs text-ink-400 hover:text-gold-300">
                  ← Changer d'invitation
                </button>
              </div>

              <div>
                <label className="block text-sm text-ink-300 mb-3">Serez-vous présent ?</label>
                <div className="grid grid-cols-3 gap-3">
                  <StatusButton active={status === 'confirmed'} onClick={() => setStatus('confirmed')} icon={<Check size={18} />} label="Présent" />
                  <StatusButton active={status === 'declined'} onClick={() => setStatus('declined')} icon={<X size={18} />} label="Absent" />
                  <StatusButton active={status === 'pending'} onClick={() => setStatus('pending')} icon={<Minus size={18} />} label="Indécis" />
                </div>
              </div>

              {status === 'confirmed' && (
                <>
                  <div>
                    <label className="block text-sm text-ink-300 mb-2">Nombre de personnes présentes</label>
                    <input
                      type="number"
                      min={1}
                      max={invitations.find((i) => i.id === foundInv)?.maxPeople ?? 10}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-gold-400 focus:outline-none"
                      value={attendingCount}
                      onChange={(e) => setAttendingCount(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-ink-300 mb-2">Choix des boissons</label>
                    <div className="space-y-2">
                      {people.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Wine size={16} className="text-gold-400 shrink-0" />
                          <input
                            className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:border-gold-400 focus:outline-none"
                            placeholder="Prénom"
                            value={p.firstName}
                            onChange={(e) => setPeople((prev) => prev.map((x, i) => i === idx ? { ...x, firstName: e.target.value } : x))}
                          />
                          <select
                            className="w-32 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:border-gold-400 focus:outline-none"
                            value={p.beverageId}
                            onChange={(e) => setPeople((prev) => prev.map((x, i) => i === idx ? { ...x, beverageId: e.target.value } : x))}
                          >
                            <option value="" className="bg-ink-800">Boisson</option>
                            {beverages.map((b) => (
                              <option key={b.id} value={b.id} className="bg-ink-800">{b.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <button
                        onClick={() => setPeople((prev) => [...prev, { firstName: '', beverageId: '' }])}
                        className="text-xs text-gold-300 hover:text-gold-400"
                      >
                        + Ajouter une personne
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-ink-300 mb-2">Note (optionnel)</label>
                <textarea
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white text-sm focus:border-gold-400 focus:outline-none"
                  rows={2}
                  placeholder="Restriction alimentaire, remarque…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                onClick={submitRsvp}
                className="w-full rounded-lg bg-gold-500 px-6 py-3.5 text-white font-medium transition-colors hover:bg-gold-600"
              >
                Confirmer ma réponse
              </button>
            </div>
          )}

          {submitted && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage-500/20">
                <Check size={40} className="text-sage-400" />
              </div>
              <h3 className="font-display text-3xl text-white">Merci !</h3>
              <p className="text-ink-300">
                Votre réponse a bien été enregistrée.<br />
                Nous avons hâte de célébrer avec vous.
              </p>
              <button
                onClick={() => { setFoundInv(null); setSearch(''); setSubmitted(false); }}
                className="mt-4 text-sm text-gold-300 hover:text-gold-400"
              >
                ← Retour
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-ink-900 py-12 px-6 text-center">
        {logo ? (
          <img src={logo} alt="Logo" className="mx-auto h-12 w-12 object-contain mb-3" />
        ) : (
          <Heart size={20} className="text-gold-500 mx-auto mb-3" fill="currentColor" />
        )}
        <p className="font-display text-xl text-white">{settings.brideName} & {settings.groomName}</p>
        <p className="text-ink-400 text-sm mt-1">{formatDate(settings.weddingDate)}</p>
        <p className="text-ink-500 text-xs mt-6">
          Design by <span className="font-medium text-gold-400">Igugu Etienne</span>
        </p>
      </div>
    </div>
  );
}

function EventCard({ title, event, icon }: { title: string; event: WeddingEvent; icon: React.ReactNode }) {
  if (!event.date && !event.venueName) return null;
  return (
    <div className="card p-6 sm:p-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-50">
          {icon}
        </div>
        <h3 className="font-display text-2xl text-ink-800">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 ml-2">
        {event.date && (
          <div className="flex items-center gap-2 text-ink-600">
            <Calendar size={18} className="text-gold-500" />
            <span>{formatDate(event.date)}{event.time && ` à ${formatTime(event.time)}`}</span>
          </div>
        )}
        {event.venueName && (
          <div className="flex items-center gap-2 text-ink-600">
            <MapPin size={18} className="text-gold-500" />
            <span>{event.venueName}</span>
          </div>
        )}
        {event.venueAddress && (
          <div className="flex items-center gap-2 text-ink-500 text-sm sm:col-span-2">
            <MapPin size={14} className="text-ink-300" />
            <span>{event.venueAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
        active
          ? 'bg-gold-500 text-white border-gold-500'
          : 'bg-white/5 text-ink-200 border-white/20 hover:bg-white/10'
      }`}
    >
      {icon} {label}
    </button>
  );
}
