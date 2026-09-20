import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScanLine,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Users as UsersIcon,
  RotateCcw,
  X,
  AlertTriangle,
} from 'lucide-react';
import jsQR from 'jsqr';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useInvitations, useGuests, useRsvps } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import type { Invitation } from '@/types';

export function ArrivalsScreen() {
  const invitations = useInvitations();
  const guests = useGuests();
  const rsvps = useRsvps();
  const { show } = useToast();

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastScanned, setLastScanned] = useState<Invitation | null>(null);
  const [flash, setFlash] = useState<'success' | 'warning' | 'info' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ token: string; time: number }>({ token: '', time: 0 });

  const guestsByInv = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) m.set(g.invitationId, (m.get(g.invitationId) ?? 0) + 1);
    return m;
  }, [guests]);

  const rsvpByInv = useMemo(() => new Map(rsvps.map((r) => [r.invitationId, r])), [rsvps]);

  const checkedInList = useMemo(
    () =>
      invitations
        .filter((i) => i.checkedInAt != null)
        .sort((a, b) => (b.checkedInAt ?? 0) - (a.checkedInAt ?? 0)),
    [invitations]
  );

  const checkedInCount = checkedInList.length;
  const totalInvitations = invitations.length;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return invitations
      .filter(
        (i) =>
          i.invitationNumber.toLowerCase().includes(q) ||
          i.familyName.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [invitations, search]);

  const checkIn = useCallback(
    async (inv: Invitation): Promise<'success' | 'already' | 'declined'> => {
      const rsvp = rsvpByInv.get(inv.id);
      if (rsvp?.status === 'declined') {
        setLastScanned(inv);
        setFlash('warning');
        return 'declined';
      }
      if (inv.checkedInAt != null) {
        setLastScanned(inv);
        setFlash('info');
        return 'already';
      }
      const now = Date.now();
      await db.invitations.put({ ...inv, checkedInAt: now, updatedAt: now });
      setLastScanned({ ...inv, checkedInAt: now });
      setFlash('success');
      return 'success';
    },
    [rsvpByInv]
  );

  const undoCheckIn = async (inv: Invitation) => {
    await db.invitations.put({ ...inv, checkedInAt: null, updatedAt: Date.now() });
    show('info', `Arrivée de ${inv.familyName} annulée.`);
    if (lastScanned?.id === inv.id) setLastScanned(null);
  };

  const processScan = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (
        decodedText === lastScanRef.current.token &&
        now - lastScanRef.current.time < 3000
      ) {
        return;
      }
      lastScanRef.current = { token: decodedText, time: now };

      const parts = decodedText.split('|');
      const token = parts.length > 1 ? parts[1] : parts[0];
      const invNumber = parts.length > 1 ? parts[0] : null;

      const inv = invitations.find(
        (i) => i.qrToken === token || (invNumber && i.invitationNumber === invNumber)
      );

      if (!inv) {
        show('error', 'QR code non reconnu — aucune invitation correspondante.');
        return;
      }

      void checkIn(inv).then((result) => {
        if (result === 'success') {
          show('success', `${inv.familyName} est arrivé ! Bienvenue.`);
        } else if (result === 'already') {
          show('info', `${inv.familyName} est déjà enregistré comme présent.`);
        } else if (result === 'declined') {
          show('warning', `${inv.familyName} avait décliné l'invitation.`);
        }
      });
    },
    [invitations, checkIn, show]
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      processScan(code.data);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [processScan]);

  const stopScanning = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Votre navigateur ne supporte pas l'accès à la caméra. Utilisez Chrome, Safari ou Firefox récent."
      );
      return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setCameraError(
        "La caméra nécessite une connexion sécurisée (HTTPS). Si vous accédez à l'application via une adresse IP, utilisez localhost ou une connexion HTTPS."
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;

      await video.play();

      setScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      let msg = "Impossible d'accéder à la caméra.";
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          msg = "L'accès à la caméra a été refusé. Autorisez la caméra dans les réglages du navigateur.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'Aucune caméra détectée sur cet appareil.';
        } else if (err.name === 'NotReadableError') {
          msg = 'La caméra est déjà utilisée par une autre application. Fermez les autres applications utilisant la caméra.';
        } else if (err.name === 'OverconstrainedError') {
          msg = 'Aucune caméra avec les caractéristiques demandées. Essayez sans contraintes.';
        } else {
          msg = err.message || msg;
        }
      }
      setCameraError(msg);
      show('error', 'Caméra indisponible. Utilisez la recherche manuelle ci-dessous.');
    }
  }, [tick, show]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const flashStyles = {
    success: 'border-green-300 bg-green-50 text-green-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-800',
    info: 'border-blue-300 bg-blue-50 text-blue-800',
  };
  const flashIcons = {
    success: CheckCircle2,
    warning: XCircle,
    info: Clock,
  };

  const isNotHttps =
    typeof location !== 'undefined' &&
    location.protocol !== 'https:' &&
    location.hostname !== 'localhost';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arrivées — Scan QR"
        subtitle={`${checkedInCount} arrivé(s) sur ${totalInvitations} invitations`}
        icon={<ScanLine size={22} />}
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-2xl font-semibold font-display text-ink-800">{checkedInCount}</p>
            <p className="text-xs text-ink-400">Présents dans la salle</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-2xl font-semibold font-display text-ink-800">{totalInvitations - checkedInCount}</p>
            <p className="text-xs text-ink-400">Pas encore arrivés</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
            <UsersIcon size={20} />
          </div>
          <div>
            <p className="text-2xl font-semibold font-display text-ink-800">
              {checkedInList.reduce((s, i) => s + (guestsByInv.get(i.id) ?? 0), 0)}
            </p>
            <p className="text-xs text-ink-400">Personnes accueillies</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner section */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-ink-800">Scanner caméra</h3>
            {scanning ? (
              <button onClick={stopScanning} className="btn-secondary btn-sm">
                <CameraOff size={16} /> Arrêter
              </button>
            ) : (
              <button onClick={() => void startScanning()} className="btn-primary btn-sm">
                <Camera size={16} /> Démarrer la caméra
              </button>
            )}
          </div>

          {/* Scanner viewport */}
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-xl overflow-hidden bg-ink-900 aspect-square max-w-sm mx-auto object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            {!scanning && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-400 pointer-events-none">
                <ScanLine size={48} className="mb-3 opacity-40" />
                <p className="text-sm">Appuyez sur « Démarrer la caméra »</p>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-60 h-60 border-2 border-gold-400 rounded-xl shadow-lg" />
              </div>
            )}
          </div>

          {/* HTTPS warning */}
          {isNotHttps && !scanning && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Connexion non sécurisée détectée</p>
                <p className="text-xs mt-1">
                  La caméra nécessite HTTPS. Si vous accédez via une adresse IP (ex : 192.168.x.x),
                  le navigateur bloquera la caméra. Utilisez une connexion HTTPS ou localhost.
                </p>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Caméra indisponible</p>
              <p className="text-xs mt-1">{cameraError}</p>
              <p className="text-xs mt-1">Vérifiez les autorisations du navigateur ou utilisez la recherche manuelle.</p>
            </div>
          )}

          {/* Last scanned result */}
          {lastScanned && flash && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 flex items-center gap-3 animate-slide-up ${flashStyles[flash]}`}
            >
              {(() => {
                const Icon = flashIcons[flash];
                return <Icon size={20} className="shrink-0" />;
              })()}
              <div className="flex-1">
                <p className="font-medium">{lastScanned.familyName}</p>
                <p className="text-xs opacity-80">
                  {lastScanned.invitationNumber}
                  {lastScanned.checkedInAt
                    ? ` — arrivé à ${new Date(lastScanned.checkedInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => { setLastScanned(null); setFlash(null); }}
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Manual search section */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-800 mb-4">Recherche manuelle</h3>
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-10"
              placeholder="Numéro d'invitation ou nom de famille…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((inv) => {
                const isCheckedIn = inv.checkedInAt != null;
                const rsvp = rsvpByInv.get(inv.id);
                const guestCount = guestsByInv.get(inv.id) ?? 0;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gold-600 font-semibold">{inv.invitationNumber}</p>
                      <p className="font-medium text-ink-800 truncate">{inv.familyName}</p>
                      <p className="text-xs text-ink-400">
                        {guestCount}/{inv.maxPeople} personnes
                        {rsvp?.status === 'confirmed' && ' · Présent'}
                        {rsvp?.status === 'declined' && ' · Absent'}
                      </p>
                    </div>
                    {isCheckedIn ? (
                      <div className="flex items-center gap-2">
                        <span className="badge-green flex items-center gap-1">
                          <CheckCircle2 size={14} /> Arrivé
                        </span>
                        <button
                          onClick={() => void undoCheckIn(inv)}
                          className="btn-icon btn-sm hover:text-amber-600"
                          title="Annuler l'arrivée"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          void checkIn(inv).then((result) => {
                            if (result === 'success') show('success', `${inv.familyName} est arrivé !`);
                            else if (result === 'already') show('info', 'Déjà enregistré.');
                            else if (result === 'declined') show('warning', `${inv.familyName} avait décliné.`);
                          });
                        }}
                        className="btn-primary btn-sm"
                      >
                        <CheckCircle2 size={16} /> Arrivé
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {search && searchResults.length === 0 && (
            <p className="text-center text-sm text-ink-400 py-4">Aucune invitation trouvée.</p>
          )}

          {!search && (
            <p className="text-center text-sm text-ink-400 py-4">
              Tapez un numéro (ex : INV-001) ou un nom pour enregistrer une arrivée manuellement.
            </p>
          )}
        </div>
      </div>

      {/* Arrivals list */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink-800">Liste des arrivées</h3>
          {checkedInCount > 0 && (
            <span className="text-sm text-ink-400">{checkedInCount} arrivée(s)</span>
          )}
        </div>

        {checkedInList.length === 0 ? (
          <EmptyState
            icon={<ScanLine size={40} />}
            title="Aucune arrivée enregistrée"
            description="Scannez un QR code ou recherchez une invitation pour marquer l'arrivée d'un invité."
          />
        ) : (
          <div className="space-y-2">
            {checkedInList.map((inv) => {
              const guestCount = guestsByInv.get(inv.id) ?? 0;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 transition-colors hover:bg-gold-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600 shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-800 truncate">{inv.familyName}</p>
                      <p className="text-xs text-ink-400">
                        {inv.invitationNumber} · {guestCount}/{inv.maxPeople} personnes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-ink-500 hidden sm:inline">
                      {inv.checkedInAt
                        ? new Date(inv.checkedInAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    <button
                      onClick={() => void undoCheckIn(inv)}
                      className="btn-icon btn-sm hover:text-amber-600"
                      title="Annuler l'arrivée"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
