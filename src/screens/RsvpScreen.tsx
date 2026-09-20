import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Search,
  Check,
  X,
  Minus,
  Save,
  Upload,
  Wine,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useInvitations, useGuests, useRsvps, useBeverages, useSettings } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import { mergeRsvpImport, parseBackupFile } from '@/lib/backup';
import type { RsvpStatus, Invitation } from '@/types';

interface PersonChoice {
  guestId: string | null; // null = a person allowed but not yet registered as a Guest
  firstName: string;
  beverageId: string;
  quantity: number;
}

export function RsvpScreen() {
  const invitations = useInvitations();
  const guests = useGuests();
  const rsvps = useRsvps();
  const beverages = useBeverages();
  const settings = useSettings();
  const { show } = useToast();

  const [search, setSearch] = useState('');
  const [selectedInv, setSelectedInv] = useState<Invitation | null>(null);
  const [status, setStatus] = useState<RsvpStatus>('pending');
  const [attendingCount, setAttendingCount] = useState(0);
  const [people, setPeople] = useState<PersonChoice[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const rsvpByInv = useMemo(() => new Map(rsvps.map((r) => [r.invitationId, r])), [rsvps]);
  const invGuests = useMemo(
    () => (selectedInv ? guests.filter((g) => g.invitationId === selectedInv.id) : []),
    [guests, selectedInv]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return invitations
      .filter(
        (i) =>
          i.invitationNumber.toLowerCase().includes(q) ||
          i.familyName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [invitations, search]);

  const selectInv = (inv: Invitation) => {
    setSelectedInv(inv);
    setSearch(inv.invitationNumber);
    const existing = rsvpByInv.get(inv.id);
    setStatus(existing?.status ?? 'pending');
    setAttendingCount(existing?.attendingCount ?? 0);
    setNote(existing?.note ?? '');
    const invG = guests.filter((g) => g.invitationId === inv.id);
    setPeople(
      invG.map((g) => ({
        guestId: g.id,
        firstName: g.firstName,
        beverageId: g.beverageId ?? '',
        quantity: g.beverageQuantity ?? 1,
      }))
    );
  };

  const addPerson = () => {
    setPeople((p) => [...p, { guestId: null, firstName: '', beverageId: '', quantity: 1 }]);
  };

  const updatePerson = (idx: number, patch: Partial<PersonChoice>) => {
    setPeople((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const removePerson = (idx: number) => {
    setPeople((p) => p.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!selectedInv) return;
    setSaving(true);
    try {
      const now = Date.now();
      // upsert RSVP
      const existing = rsvpByInv.get(selectedInv.id);
      await db.rsvps.put({
        id: existing?.id ?? selectedInv.id,
        invitationId: selectedInv.id,
        status,
        attendingCount: status === 'confirmed' ? attendingCount : 0,
        submittedAt: existing?.submittedAt ?? now,
        note: note || null,
        updatedAt: now,
      });

      // upsert guest beverage choices and create missing guests
      for (const p of people) {
        if (p.guestId) {
          const g = await db.guests.get(p.guestId);
          if (g) {
            await db.guests.put({
              ...g,
              beverageId: p.beverageId || null,
              beverageQuantity: p.beverageId ? p.quantity : null,
              updatedAt: now,
            });
          }
        } else if (p.firstName.trim()) {
          await db.guests.add({
            id: crypto.randomUUID(),
            invitationId: selectedInv.id,
            firstName: p.firstName.trim(),
            lastName: selectedInv.familyName,
            tableId: null,
            seatNumber: null,
            beverageId: p.beverageId || null,
            beverageQuantity: p.beverageId ? p.quantity : null,
            isChild: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      show('success', `RSVP enregistré pour ${selectedInv.familyName}.`);
    } catch (e) {
      show('error', "Erreur lors de l'enregistrement du RSVP.");
    } finally {
      setSaving(false);
    }
  };

  const importRsvp = async (file: File) => {
    setImportBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept either a full backup file or a standalone { rsvps: [...] } object
      const rsvpList = Array.isArray(parsed) ? parsed : parsed.rsvps ?? parsed.data?.rsvps ?? [];
      if (!Array.isArray(rsvpList)) throw new Error('Aucune liste de RSVP trouvée dans ce fichier.');
      const count = await mergeRsvpImport(rsvpList);
      show('success', `${count} RSVP importés.`);
    } catch (e) {
      show('error', 'Fichier RSVP invalide ou illisible.');
    } finally {
      setImportBusy(false);
    }
  };

  const stats = useMemo(() => {
    let confirmed = 0, declined = 0, pending = 0;
    for (const inv of invitations) {
      const r = rsvpByInv.get(inv.id);
      if (!r || r.status === 'pending') pending++;
      else if (r.status === 'confirmed') confirmed++;
      else declined++;
    }
    return { confirmed, declined, pending };
  }, [invitations, rsvpByInv]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RSVP — Mode local"
        subtitle="Enregistrez les confirmations directement depuis votre appareil"
        icon={<CalendarCheck size={22} />}
        actions={
          <label className="btn-secondary cursor-pointer">
            <Upload size={18} /> Importer RSVP
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importRsvp(f); e.target.value = ''; }}
            />
          </label>
        }
      />

      {/* Offline notice */}
      <div className="card p-4 border-blue-200 bg-blue-50/50">
        <p className="text-sm text-blue-800">
          <strong>Mode 100% local.</strong> Les invités ne peuvent pas envoyer leur RSVP depuis leur propre téléphone
          vers cette application. Recueillez leur réponse (par téléphone, message, courrier) et enregistrez-la ici.
          Un RSVP à distance nécessiterait un backend de synchronisation — non inclus ici.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-display text-sage-600">{stats.confirmed}</p>
          <p className="text-xs text-ink-400">présents</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-display text-red-400">{stats.declined}</p>
          <p className="text-xs text-ink-400">absents</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-display text-ink-400">{stats.pending}</p>
          <p className="text-xs text-ink-400">en attente</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search + list */}
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-10"
              placeholder="Rechercher INV-025 ou nom de famille…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {search && searchResults.length > 0 && (
            <div className="card divide-y divide-ink-100 overflow-hidden">
              {searchResults.map((inv) => {
                const r = rsvpByInv.get(inv.id);
                return (
                  <button
                    key={inv.id}
                    onClick={() => selectInv(inv)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gold-50 ${selectedInv?.id === inv.id ? 'bg-gold-50' : ''}`}
                  >
                    <div>
                      <p className="font-mono text-xs text-gold-600">{inv.invitationNumber}</p>
                      <p className="font-medium text-ink-800">{inv.familyName}</p>
                      <p className="text-xs text-ink-400">{inv.maxPeople} pers. autorisées</p>
                    </div>
                    <span className={
                      r?.status === 'confirmed' ? 'badge-green' :
                      r?.status === 'declined' ? 'badge-red' : 'badge-gray'
                    }>
                      {r?.status === 'confirmed' ? 'Présent' : r?.status === 'declined' ? 'Absent' : 'En attente'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {search && searchResults.length === 0 && invitations.length > 0 && (
            <p className="text-sm text-ink-400 text-center py-4">Aucune invitation trouvée.</p>
          )}

          {invitations.length === 0 && (
            <EmptyState icon={<CalendarCheck size={40} />} title="Aucune invitation" description="Créez des invitations pour utiliser le RSVP." />
          )}
        </div>

        {/* Detail / form */}
        <div className="card p-6">
          {!selectedInv ? (
            <EmptyState icon={<CalendarCheck size={40} />} title="Sélectionnez une invitation" description="Recherchez une invitation à gauche pour enregistrer ou modifier son RSVP." />
          ) : (
            <div className="space-y-5">
              <div className="border-b border-ink-100 pb-4">
                <p className="font-mono text-xs text-gold-600">{selectedInv.invitationNumber}</p>
                <h3 className="font-display text-xl text-ink-800">{selectedInv.familyName}</h3>
                <p className="text-sm text-ink-400">{selectedInv.maxPeople} personnes autorisées · {invGuests.length} enregistrées</p>
              </div>

              {/* Status selector */}
              <div>
                <label className="label">Statut</label>
                <div className="grid grid-cols-3 gap-2">
                  <StatusBtn active={status === 'confirmed'} onClick={() => setStatus('confirmed')} icon={<Check size={16} />} label="Présent" color="sage" />
                  <StatusBtn active={status === 'declined'} onClick={() => setStatus('declined')} icon={<X size={16} />} label="Absent" color="red" />
                  <StatusBtn active={status === 'pending'} onClick={() => setStatus('pending')} icon={<Minus size={16} />} label="En attente" color="ink" />
                </div>
              </div>

              {status === 'confirmed' && (
                <>
                  <div>
                    <label className="label">Nombre de personnes présentes</label>
                    <input
                      type="number"
                      min={0}
                      max={selectedInv.maxPeople}
                      className="input"
                      value={attendingCount}
                      onChange={(e) => setAttendingCount(Math.min(selectedInv.maxPeople, Math.max(0, Number(e.target.value) || 0)))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">Choix des boissons</label>
                      <button onClick={addPerson} className="btn-ghost btn-sm">+ Ajouter</button>
                    </div>
                    <div className="space-y-2">
                      {people.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2">
                          <Wine size={16} className="text-gold-500 shrink-0" />
                          <input
                            className="input flex-1"
                            placeholder="Prénom"
                            value={p.firstName}
                            onChange={(e) => updatePerson(idx, { firstName: e.target.value })}
                          />
                          <select
                            className="input w-36"
                            value={p.beverageId}
                            onChange={(e) => updatePerson(idx, { beverageId: e.target.value })}
                          >
                            <option value="">Boisson</option>
                            {beverages.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button onClick={() => removePerson(idx)} className="btn-icon shrink-0 hover:text-red-500"><X size={16} /></button>
                        </div>
                      ))}
                      {people.length === 0 && <p className="text-xs text-ink-400">Aucune personne. Cliquez sur « Ajouter ».</p>}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="label">Note (optionnel)</label>
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Restriction alimentaire, remarque…" />
              </div>

              <div className="flex justify-end pt-2 border-t border-ink-100">
                <button onClick={save} disabled={saving} className="btn-primary">
                  <Save size={18} /> Enregistrer le RSVP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBtn({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: 'sage' | 'red' | 'ink' }) {
  const colorClasses = {
    sage: active ? 'bg-sage-500 text-white border-sage-500' : 'text-sage-600 border-sage-300 hover:bg-sage-500/10',
    red: active ? 'bg-red-500 text-white border-red-500' : 'text-red-500 border-red-300 hover:bg-red-500/10',
    ink: active ? 'bg-ink-500 text-white border-ink-500' : 'text-ink-500 border-ink-300 hover:bg-ink-100',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${colorClasses[color]}`}
    >
      {icon} {label}
    </button>
  );
}
