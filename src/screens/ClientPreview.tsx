import { useEffect, useState } from 'react';
import { Heart, MapPin, Clock, Calendar, Check, X, Minus, Wine, Mail, Flower2 } from 'lucide-react';
import { useSettings, useInvitations, useGuests, useRsvps, useBeverages } from '@/hooks/useLiveData';
import { useStore } from '@/store/StoreContext';
import { generateQrDataUrl } from '@/lib/pdf';
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
  const [people, setPeople] = useState<{ firstName: string; beverageId: string }[]>([{ firstName: '', beverageId: '' }]);
  const [submitted, setSubmitted] = useState(false);
  const [invitationOpened, setInvitationOpened] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

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
      if (ig.length > 0) {
        setPeople(ig.map((g) => ({ firstName: g.firstName, beverageId: g.beverageId ?? '' })));
        setAttendingCount(Math.min(2, Math.max(1, ig.length)));
      } else {
        setPeople([{ firstName: '', beverageId: '' }]);
        setAttendingCount(1);
      }
      setSubmitted(false);
      const inv = invitations.find((i) => i.id === foundInv);
      if (inv) {
        generateQrDataUrl(`${inv.invitationNumber}|${inv.qrToken}`)
          .then(setQrCodeUrl)
          .catch(() => setQrCodeUrl(null));
      } else {
        setQrCodeUrl(null);
      }
    } else {
      setQrCodeUrl(null);
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
      isNew: true,
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
  const monogram = `${settings.brideName.trim().charAt(0).toLocaleUpperCase('fr-FR')}&${settings.groomName.trim().charAt(0).toLocaleUpperCase('fr-FR')}`;

  const isGuestMode = !!inviteToken;
  const linkedInvitation = foundInv ? invitations.find((inv) => inv.id === foundInv) : undefined;
  const linkedGuestNames = linkedInvitation
    ? guests
        .filter((guest) => guest.invitationId === linkedInvitation.id)
        .map((guest) => `${guest.firstName} ${guest.lastName}`.trim())
        .filter(Boolean)
    : [];
  const envelopeGuestName = linkedGuestNames.join(' & ') || linkedInvitation?.familyName || 'Votre invitation';

  if (isGuestMode && !invitationOpened) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-[#f5efe3] via-[#ede4d3] to-[#e2d5c0] text-[#5a4632]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.5),transparent_70%)]" />

        {/* Floating decorative elements */}
        <div className="pointer-events-none absolute left-[8%] top-[12%] hidden opacity-20 sm:block">
          <Flower2 size={48} className="text-[#b8a78c]" />
        </div>
        <div className="pointer-events-none absolute right-[10%] top-[18%] hidden opacity-20 sm:block">
          <Flower2 size={36} className="text-[#b8a78c]" />
        </div>
        <div className="pointer-events-none absolute bottom-[10%] left-[12%] hidden opacity-15 sm:block">
          <Flower2 size={40} className="text-[#b8a78c]" />
        </div>

        <div className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 py-8 text-center sm:px-5 sm:py-12">
          {/* Guest name header */}
          <div className="mb-8 animate-fade-in sm:mb-12">
            <p className="text-xs font-medium uppercase tracking-[0.4em] text-[#b08d6a] sm:text-sm">Cher invité</p>
            <p className="mt-3 font-display text-2xl tracking-[0.15em] text-[#5a4632] sm:text-4xl sm:tracking-[0.25em]">
              {envelopeGuestName}
            </p>
            <div className="mx-auto mt-4 flex items-center justify-center gap-2">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9b89c]" />
              <span className="h-1.5 w-1.5 rotate-45 bg-[#c9b89c]" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9b89c]" />
            </div>
          </div>

          {/* Envelope */}
          <button
            type="button"
            aria-label="Ouvrir l'invitation"
            onClick={() => setInvitationOpened(true)}
            className="group relative w-full max-w-[580px] focus:outline-none"
          >
            {/* Envelope body with depth shadow */}
            <div className="relative mx-auto aspect-[1.5] w-full overflow-hidden rounded-[6px] bg-[#e8dcc8] shadow-[0_28px_50px_rgba(90,70,40,0.22),0_8px_16px_rgba(90,70,40,0.12)] ring-1 ring-[#d0c2aa] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-[0_36px_60px_rgba(90,70,40,0.28),0_12px_20px_rgba(90,70,40,0.14)] sm:rounded-[8px]">

              {/* Paper texture overlay */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(180,160,130,0.03)_2px,rgba(180,160,130,0.03)_4px)]" />

              {/* Bottom flap (pocket) */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#e0d3bc] to-[#d4c6ad]" style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 48%)' }} />

              {/* Left flap */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#ece2d0] to-[#ddd0bb] transition-all duration-500 group-hover:from-[#eee5d4] group-hover:to-[#e0d4c0]" style={{ clipPath: 'polygon(0 0, 50% 46%, 0 100%)' }} />

              {/* Right flap */}
              <div className="absolute inset-0 bg-gradient-to-bl from-[#e6dbca] to-[#d8ccba] transition-all duration-500 group-hover:from-[#e8dfd0] group-hover:to-[#dccfbb]" style={{ clipPath: 'polygon(100% 0, 50% 46%, 100% 100%)' }} />

              {/* Top flap (closed) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#f2e9da] to-[#e6dac6] transition-all duration-700 ease-in-out"
                style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }}
              />

              {/* Flap seam lines for realism */}
              <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 50% 50%, 0 100%)' }}>
                <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-black/[0.04] to-transparent" />
              </div>
              <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 50% 50%, 100% 100%)' }}>
                <div className="absolute right-0 top-0 h-full w-full bg-gradient-to-l from-black/[0.04] to-transparent" />
              </div>
              <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }}>
                <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-black/[0.05] to-transparent" />
              </div>

              {/* Wax seal with logo */}
              <div className="absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2">
                <div className="relative transition-all duration-500 group-hover:scale-110 group-hover:rotate-[6deg]">
                  {/* Wax seal glow */}
                  <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-[#b8654e]/20 blur-md transition-opacity duration-500 group-hover:opacity-80" />

                  {/* Wax seal outer ring */}
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#c46b52] via-[#b85a3e] to-[#a04a33] shadow-[inset_0_2px_4px_rgba(255,220,200,0.25),inset_0_-3px_6px_rgba(60,20,10,0.3),0_6px_12px_rgba(80,30,15,0.3)] sm:h-24 sm:w-24">
                    {/* Inner wax ring */}
                    <div className="flex h-[88%] w-[88%] items-center justify-center rounded-full bg-gradient-to-br from-[#b85a3e] to-[#9a4530] shadow-[inset_0_1px_3px_rgba(255,200,180,0.15),inset_0_-2px_4px_rgba(50,15,5,0.25)]">
                      {/* Logo container */}
                      <div className="flex h-[82%] w-[82%] items-center justify-center overflow-hidden rounded-full bg-[#d4a895]/30 ring-1 ring-[#e8c5b0]/40">
                        {logo ? (
                          <img src={logo} alt="Logo des mariés" className="h-full w-full rounded-full object-cover ring-1 ring-[#f0d8c8]/50" />
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <Heart size={22} className="text-[#f0d0c0]" fill="currentColor" />
                            <span className="text-[7px] font-semibold uppercase tracking-widest text-[#f0d0c0] sm:text-[9px]">Forever</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Names on envelope body */}
              <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 pt-3 text-center sm:pb-8 sm:pt-6">
                <span className="block text-balance font-display text-lg italic leading-tight text-[#6a5238] sm:text-3xl">
                  {settings.groomName} &amp; {settings.brideName}
                </span>
                {settings.weddingDate && (
                  <span className="mt-1.5 block text-[10px] font-medium tracking-[0.3em] text-[#a08560] sm:mt-2 sm:text-xs">
                    {formatDate(settings.weddingDate).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Hover hint glow */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[#c9b89c]/0 blur-2xl transition-all duration-500 group-hover:bg-[#c9b89c]/15" />
          </button>

          {/* Click prompt */}
          <div className="mt-8 animate-fade-in sm:mt-12">
            <div className="flex items-center gap-3 text-[#8a7456]">
              <span className="h-px w-6 bg-[#c9b89c]/60 sm:w-10" />
              <Mail size={18} className="animate-pulse text-[#a08560]" />
              <span className="h-px w-6 bg-[#c9b89c]/60 sm:w-10" />
            </div>
            <p className="mt-3 max-w-xs font-display text-base italic sm:max-w-none sm:text-xl">Cliquez sur l'enveloppe pour voir l'invitation</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f4ede2] text-[#4b382c]">
      <nav className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#d8c3a2]/20 bg-[#f5eee4] px-5 text-[#503426] sm:px-10">
        <span className="font-display text-lg font-semibold">{monogram.slice(0, 1)}<span className="text-[#a66f42]">&amp;</span>{monogram.slice(2)}</span>
        <div className="hidden items-center gap-8 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#765c45] sm:flex">
          <a href="#programme" className="transition-colors hover:text-[#a66f42]">Programme</a>
          <a href="#rsvp" className="transition-colors hover:text-[#a66f42]">Répondre</a>
        </div>
        {settings.weddingDate && <span className="text-[9px] font-semibold tracking-[0.12em] text-[#765c45]">{formatDate(settings.weddingDate)}</span>}
      </nav>
      {/* Close button — only for admin preview, not for guests */}
      {!isGuestMode && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <X size={18} /> Quitter l'aperçu
        </button>
      )}

      {/* Hero section */}
      <div className="relative flex min-h-[calc(100svh-3.5rem)] max-h-[calc(100svh-3.5rem)] items-center justify-center overflow-hidden bg-[#2f211b]">
        <div className="absolute inset-0">
          {heroImage ? (
            <img src={heroImage} alt="Couple" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,#644b3a,#2f211b_68%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#2f211b]/25 via-[#2f211b]/55 to-[#2f211b]/95" />
        </div>

        <div className="relative z-10 w-full max-w-6xl px-5 py-5 text-center animate-fade-in sm:px-12 sm:py-10 sm:text-left">
          <div className="mb-4 flex items-center justify-center gap-3 text-gold-300/80 sm:mb-6 sm:justify-start">
            <span className="h-px w-12 bg-gold-300/60" /><Heart size={16} fill="currentColor" /><span className="h-px w-12 bg-gold-300/60" />
          </div>
          {logo && (
            <img src={logo} alt="Logo" className="mx-auto mb-3 h-12 w-12 object-contain sm:mx-0 sm:h-16 sm:w-16" />
          )}
          <p className="text-[#c49a70] text-[10px] font-medium tracking-[0.38em] uppercase mb-3 sm:text-xs sm:mb-5">Nous nous marions</p>
          <h1 className="break-words font-display text-3xl leading-tight text-[#c49a70] sm:text-8xl">
            {settings.brideName}
          </h1>
          <div className="my-2 flex items-center justify-center gap-3 text-gold-300 sm:my-5 sm:gap-4">
            <span className="h-px w-12 bg-gold-400" />
            <Heart size={24} className="text-gold-400" fill="currentColor" />
            <span className="h-px w-12 bg-gold-400" />
          </div>
          <h1 className="break-words font-display text-3xl leading-tight text-[#c49a70] sm:text-8xl">
            {settings.groomName}
          </h1>

          {countdown !== null && countdown > 0 && (
            <p className="mt-3 text-gold-300 font-display text-lg sm:mt-8 sm:text-2xl">
              Dans {countdown} jours
            </p>
          )}
          {settings.weddingDate && (
            <div className="mt-3 flex w-full max-w-sm flex-col items-center gap-1 sm:mt-6 sm:gap-1.5 border-l border-[#b98c63]/60 py-3 pl-4 sm:items-start">
              <div className="flex items-center gap-2">
                <span className="text-gold-300 text-xs font-semibold tracking-widest uppercase">Date</span>
                <span className="h-px w-4 bg-gold-400/50" />
                <span className="text-[#ead7c0] text-lg font-medium">
                  {formatDate(settings.weddingDate)}
                </span>
              </div>
              {settings.receptionTime && (
                <div className="flex items-center gap-2">
                  <span className="text-gold-300 text-xs font-semibold tracking-widest uppercase">Réception</span>
                  <span className="h-px w-4 bg-gold-400/50" />
                  <span className="flex items-center gap-1.5 text-[#ead7c0] text-lg font-medium">
                    <Clock size={15} className="text-[#6d967b]" /> {formatTime(settings.receptionTime)}
                  </span>
                </div>
              )}
              {settings.venueName && (
                <div className="flex items-center gap-2">
                  <span className="text-gold-300 text-xs font-semibold tracking-widest uppercase">Lieu de la réception</span>
                  <span className="h-px w-4 bg-gold-400/50" />
                  <span className="text-ink-200 text-lg font-medium">{settings.venueName}</span>
                </div>
              )}
            </div>
          )}

          {settings.welcomeMessage && (
            <p className="mt-3 max-w-md text-sm italic leading-relaxed text-[#bda58d] sm:mt-6 sm:text-base">
              {settings.welcomeMessage}
            </p>
          )}

          {qrCodeUrl && (
            <div className="mt-3 inline-flex max-w-[calc(100vw-2rem)] flex-col items-center gap-2 rounded-2xl border border-[#c49a70]/30 bg-[#050403]/55 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.24)] sm:absolute sm:right-0 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:items-start sm:p-3">
              <div className="rounded-xl bg-white p-2 shadow-lg sm:p-3">
                <img src={qrCodeUrl} alt="QR code d'invitation" className="h-20 w-20 sm:h-32 sm:w-32" />
              </div>
            </div>
          )}

          <a
            href="#rsvp"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold-300/70 bg-gold-500/90 px-8 py-3.5 text-white font-medium text-lg shadow-[0_10px_30px_rgba(184,134,11,0.24)] transition-all hover:scale-105 hover:bg-gold-400"
          >
            <Heart size={20} fill="currentColor" />
            Confirmez votre présence
          </a>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="text-gold-300 text-xs tracking-widest uppercase">Défiler</div>
        </div>
      </div>

      {/* Couple section */}
      <section className="border-y border-[#cbbca9] bg-[linear-gradient(180deg,#eadfd0_0%,#e5e4d8_100%)] px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-center gap-3 text-[#a66f42]"><span className="h-px w-10 bg-[#b98c63]" /><Heart size={14} fill="currentColor" /><span className="h-px w-10 bg-[#b98c63]" /></div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#9b7655]">Les mariés</p>
          <div className="mt-8 flex items-center justify-center gap-2 sm:gap-10">
            <div className="min-w-0 flex-1 text-right"><p className="break-words font-display text-2xl italic leading-tight text-[#503426] sm:text-5xl">{settings.brideName}</p><p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[#9b7655]">La mariée</p></div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#a9bbaa] bg-[#dce6d8] shadow-[0_6px_16px_rgba(85,76,55,0.18)] sm:h-24 sm:w-24">
              {logo ? <img src={logo} alt="Logo des mariés" className="h-full w-full rounded-full object-cover p-1" /> : <Heart size={28} className="text-[#8f4c35]" fill="currentColor" />}
            </div>
            <div className="min-w-0 flex-1 text-left"><p className="break-words font-display text-2xl italic leading-tight text-[#503426] sm:text-5xl">{settings.groomName}</p><p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[#9b7655]">Le marié</p></div>
          </div>
        </div>
      </section>

      {/* Events section */}
      <div id="programme" className="relative overflow-hidden border-y border-[#ded2c3] bg-[#f7f1e8] px-4 py-16 text-[#4b382c] sm:px-6 sm:py-24">
        <div className="pointer-events-none absolute left-0 top-10 h-40 w-40 rounded-full bg-[#dce6d8]/45 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#ead8c8]/45 blur-3xl" />
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-3 flex items-center justify-center gap-3 text-gold-600"><span className="h-px w-10 bg-gold-300" /><Heart size={14} fill="currentColor" /><span className="h-px w-10 bg-gold-300" /></div>
          <div className="mb-3 flex items-center gap-3 text-[#a76e4c]"><span className="text-[10px] font-semibold tracking-[0.25em]">03</span><span className="h-px w-12 bg-[#c9a98a]" /></div>
          <div className="mb-12 flex items-center gap-3"><span className="h-px w-8 bg-[#bd8b6d]" /><span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#9c6b50]">Le rendez-vous</span></div>
          <h2 className="font-display text-5xl leading-[0.95] text-[#3e2d25] sm:text-7xl">Programme</h2>

          <div className="mt-12 space-y-0 border-t border-[#d9cbbd]">
            <EventCard
              title="La Dot"
              event={ev.dot}
              icon={<Heart size={24} className="text-gold-500" fill="currentColor" />}
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
      <div id="rsvp" className="scroll-mt-0 border-t border-[#a77d62] bg-[linear-gradient(135deg,#8b6650_0%,#795644_100%)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-x-16 gap-y-8 sm:grid-cols-2">
          <div className="mb-2 flex items-center gap-3 text-[#e6c6ad] sm:col-span-2"><span className="text-[10px] font-semibold tracking-[0.25em]">04</span><span className="h-px w-12 bg-[#c4977d]" /></div>
          <div className="self-start sm:row-start-2">
            <div className="mb-7 flex items-center gap-3"><span className="h-px w-8 bg-[#c4977d]" /><span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#e6c6ad]">Votre présence</span></div>
            <h2 className="font-display text-5xl leading-[0.92] text-[#fff7ed] sm:text-7xl">Répondez à<br /><em className="text-[#c48768]">notre invitation</em></h2>
            <p className="mt-10 max-w-md text-sm leading-7 text-[#ead8cc]">Votre présence est le plus beau cadeau que vous puissiez nous offrir. Merci de nous répondre avant le grand jour.</p>
          </div>

          {!foundInv && !submitted && (
            <div className="space-y-4 sm:row-start-2">
              {isGuestMode ? (
                <p className="text-center text-ink-300 text-sm mb-6">
                  Recherchez votre invitation ci-dessous pour confirmer votre présence.
                </p>
              ) : (
                <p className="text-center text-ink-300 text-sm mb-6">
                  Recherchez votre invitation par numéro ou nom de famille.
                </p>
              )}
              {!isGuestMode && (
                <input
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-ink-400 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
                  placeholder="Rechercher par nom de famille"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              {searchResults.length > 0 && !isGuestMode && (
                <div className="space-y-2">
                  {searchResults.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => selectInv(inv.id)}
                      className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                    >
                      <div>
                        <p className="text-white font-medium">{inv.familyName}</p>
                        <p className="text-xs text-ink-400">{inv.maxPeople} personnes autorisées</p>
                      </div>
                      <span className="text-gold-300 text-sm">Sélectionner →</span>
                    </button>
                  ))}
                </div>
              )}
              {isGuestMode && !foundInv && (
                <div className="rounded-lg bg-white/5 px-4 py-6 text-center">
                  <p className="text-white font-medium">Aucune invitation trouvée pour ce lien.</p>
                  <p className="text-xs text-ink-400 mt-2">Vérifiez que vous avez bien utilisé le lien qui vous a été envoyé.</p>
                </div>
              )}
              {search && searchResults.length === 0 && !isGuestMode && (
                <p className="text-center text-ink-400 text-sm">Aucune invitation trouvée.</p>
              )}
            </div>
          )}

          {foundInv && !submitted && (
            <div className="space-y-6 sm:row-start-2">
              <div className="text-center">
                <h3 className="font-display text-2xl text-white">
                  Famille {invitations.find((i) => i.id === foundInv)?.familyName}
                </h3>
                {!isGuestMode && (
                  <button onClick={() => { setFoundInv(null); setSearch(''); }} className="mt-2 text-xs text-ink-400 hover:text-gold-300">
                    ← Changer d'invitation
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#ead8cc] mb-3">Serez-vous parmi nous ?</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatusButton active={status === 'confirmed'} onClick={() => setStatus('confirmed')} icon={<Check size={18} />} label="Présent" />
                  <StatusButton active={status === 'declined'} onClick={() => setStatus('declined')} icon={<X size={18} />} label="Absent" />
                  <StatusButton active={status === 'pending'} onClick={() => setStatus('pending')} icon={<Minus size={18} />} label="Indécis" />
                </div>
              </div>

              {status === 'confirmed' && (
                <>
                  <div>
                    <label className="block text-sm text-ink-300 mb-2">Nombre de personnes présentes</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <CountButton
                        active={attendingCount === 1}
                        onClick={() => {
                          setAttendingCount(1);
                          setPeople((prev) => prev.slice(0, 1).length === 1 ? prev.slice(0, 1) : [{ firstName: '', beverageId: '' }]);
                        }}
                        label="1 personne"
                      />
                      <CountButton
                        active={attendingCount === 2}
                        onClick={() => {
                          setAttendingCount(2);
                          setPeople((prev) => {
                            const arr = prev.slice(0, 2);
                            while (arr.length < 2) arr.push({ firstName: '', beverageId: '' });
                            return arr;
                          });
                        }}
                        label="2 personnes"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-ink-300 mb-2">Choix des boissons</label>
                    <div className="space-y-3">
                      {people.slice(0, attendingCount).map((p, idx) => (
                        <div key={idx} className="space-y-2">
                          <p className="text-xs text-gold-300 font-medium">Personne {idx + 1}</p>
                          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            <Wine size={16} className="hidden shrink-0 text-gold-400 sm:block" />
                            <input
                              className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:border-gold-400 focus:outline-none"
                              placeholder="Prénom"
                              value={p.firstName}
                              onChange={(e) => setPeople((prev) => prev.map((x, i) => i === idx ? { ...x, firstName: e.target.value } : x))}
                            />
                            <select
                              className="min-h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-gold-400 focus:outline-none sm:w-32"
                              value={p.beverageId}
                              onChange={(e) => setPeople((prev) => prev.map((x, i) => i === idx ? { ...x, beverageId: e.target.value } : x))}
                            >
                              <option value="" className="bg-ink-800">Boisson</option>
                              {beverages.map((b) => (
                                <option key={b.id} value={b.id} className="bg-ink-800">{b.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#ead8cc] mb-2">Un mot pour les mariés</label>
                <textarea
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white text-sm focus:border-gold-400 focus:outline-none"
                  rows={2}
                  placeholder="Un message, une attention…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                onClick={submitRsvp}
                className="min-h-12 w-full rounded-lg bg-gold-500 px-6 py-3.5 font-medium text-white transition-colors hover:bg-gold-600"
              >
                Confirmer ma réponse
              </button>
            </div>
          )}

          {submitted && (
            <div className="mx-auto max-w-md rounded-2xl sm:row-start-2 border border-[#d4bb95]/30 bg-[#fffaf1]/[0.06] p-8 text-center space-y-4">
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

      {settings.airtelMoneyNumber && (
        <section className="border-t border-[#a77d62] bg-[#8b6650] px-6 py-10 text-center text-[#fff7ed]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#f0d8c4]">Soutenir les mariés</p>
          <h3 className="mt-2 font-display text-3xl">Airtel Money</h3>
          <p className="mt-2 text-sm text-[#f8e9dc]">Vous pouvez envoyer votre contribution au</p>
          <p className="mt-3 font-mono text-xl font-semibold tracking-wider">{settings.airtelMoneyNumber}</p>
        </section>
      )}

      {/* Footer */}
      <div className="border-t border-[#4d382d] bg-[#2f211b] px-6 py-16 text-center">
        {logo ? (
          <img src={logo} alt="Logo" className="mx-auto h-12 w-12 object-contain mb-3" />
        ) : (
          <Heart size={20} className="text-gold-500 mx-auto mb-3" fill="currentColor" />
        )}
        <p className="font-display text-3xl text-[#c49a70]">{settings.brideName} <span className="text-gold-300">&amp;</span> {settings.groomName}</p>
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
  const dateParts = formatDate(event.date).split(' ');
  const day = dateParts[0] ?? '';
  const month = dateParts[1]?.slice(0, 3).toUpperCase() ?? '';

  return (
    <article className="group grid grid-cols-[78px_minmax(0,1fr)_16px] gap-4 border-b border-[#d9cbbd] py-7 transition-colors hover:bg-[#eee4d7]/70 sm:grid-cols-[110px_minmax(0,1fr)_24px] sm:gap-8 sm:py-9">
      <div className="flex flex-col justify-center text-center text-[#a45f43]">
        <span className="font-display text-4xl leading-none sm:text-5xl">{day}</span>
        <span className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-[#9c806c]">{month}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-[#a76e4c]">
          <Clock size={13} />
          <span className="text-[10px] font-semibold tracking-[0.2em]">{formatTime(event.time)}</span>
        </div>
        <div className="flex items-center gap-2">
          <h3 className="font-display text-2xl leading-tight text-[#3e2d25] sm:text-3xl">{title}</h3>
          <span className="hidden text-[#6d967b] sm:block">{icon}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-[#806f64]">{event.venueName ? `Un moment précieux à partager à ${event.venueName}.` : 'Un moment précieux à partager ensemble.'}</p>
        {event.venueName && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#8d7c70]"><MapPin size={12} className="text-[#6d967b]" />{event.venueName}</p>}
      </div>
      <span className="self-center text-xl text-[#a76e4c] transition-transform group-hover:translate-x-1">›</span>
    </article>
  );
}

function StatusButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
        active
          ? 'bg-[#6d4d3e] text-[#fff7ed] border-[#c4977d] shadow-[0_6px_16px_rgba(60,35,25,0.2)]'
          : 'bg-transparent text-[#f0ddd0] border-[#d4bb95]/50 hover:bg-[#fffaf1]/[0.1]'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function CountButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-12 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
        active
          ? 'bg-[#6d4d3e] text-[#fff7ed] border-[#c4977d] shadow-[0_6px_16px_rgba(60,35,25,0.2)]'
          : 'bg-transparent text-[#f0ddd0] border-[#d4bb95]/50 hover:bg-[#fffaf1]/[0.1]'
      }`}
    >
      {label}
    </button>
  );
}
