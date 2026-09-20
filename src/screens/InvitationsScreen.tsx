import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Mail,
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  Users as UsersIcon,
  Download,
  Send,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useInvitations, useGuests, useRsvps, useSettings } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import { uuid, generateQrToken, nextInvitationNumber } from '@/lib/id';
import { generateQrDataUrl, generateQrInvitationsPdf } from '@/lib/pdf';
import type { Invitation } from '@/types';

interface FormValues {
  familyName: string;
  maxPeople: number;
  contactPhone?: string;
  email?: string;
  notes?: string;
}

export function InvitationsScreen() {
  const invitations = useInvitations();
  const guests = useGuests();
  const rsvps = useRsvps();
  const settings = useSettings();
  const { show } = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrInv, setQrInv] = useState<Invitation | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendInv, setSendInv] = useState<Invitation | null>(null);
  const [sendQrUrl, setSendQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const guestsByInv = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) m.set(g.invitationId, (m.get(g.invitationId) ?? 0) + 1);
    return m;
  }, [guests]);

  const rsvpByInv = useMemo(() => new Map(rsvps.map((r) => [r.invitationId, r])), [rsvps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter(
      (i) =>
        i.invitationNumber.toLowerCase().includes(q) ||
        i.familyName.toLowerCase().includes(q)
    );
  }, [invitations, search]);

  const openCreate = () => {
    setEditing(null);
    reset({ familyName: '', maxPeople: 2, contactPhone: '', email: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (inv: Invitation) => {
    setEditing(inv);
    reset({
      familyName: inv.familyName,
      maxPeople: inv.maxPeople,
      contactPhone: inv.contactPhone ?? '',
      email: inv.email ?? '',
      notes: inv.notes ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const now = Date.now();
    if (editing) {
      await db.invitations.put({
        ...editing,
        familyName: values.familyName,
        maxPeople: values.maxPeople,
        contactPhone: values.contactPhone || undefined,
        email: values.email || undefined,
        notes: values.notes || undefined,
        updatedAt: now,
      });
      show('success', `Invitation ${editing.invitationNumber} mise à jour.`);
    } else {
      const number = nextInvitationNumber(invitations);
      const id = uuid();
      await db.invitations.add({
        id,
        invitationNumber: number,
        familyName: values.familyName,
        maxPeople: values.maxPeople,
        qrToken: generateQrToken(),
        contactPhone: values.contactPhone || undefined,
        email: values.email || undefined,
        notes: values.notes || undefined,
        createdAt: now,
        updatedAt: now,
      });
      // create a pending RSVP record
      await db.rsvps.put({
        id,
        invitationId: id,
        status: 'pending',
        attendingCount: 0,
        submittedAt: null,
        note: null,
        updatedAt: now,
      });
      show('success', `Invitation ${number} créée.`);
    }
    setShowForm(false);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await db.transaction('rw', [db.invitations, db.guests, db.rsvps], async () => {
      await db.invitations.delete(deleteId);
      await db.guests.where('invitationId').equals(deleteId).delete();
      await db.rsvps.where('invitationId').equals(deleteId).delete();
    });
    show('success', 'Invitation supprimée.');
  };

  const openQr = async (inv: Invitation) => {
    setQrInv(inv);
    const url = await generateQrDataUrl(`${inv.invitationNumber}|${inv.qrToken}`);
    setQrUrl(url);
  };

  const invitationLink = (inv: Invitation): string => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?invite=${inv.qrToken}`;
  };

  const invitationMessage = (inv: Invitation): string => {
    const link = invitationLink(inv);
    const couple = settings ? `${settings.brideName} & ${settings.groomName}` : 'Notre mariage';
    const dateStr = settings?.weddingDate ? formatDateLong(settings.weddingDate) : '';
    const lines = [
      `Chère famille ${inv.familyName},`,
      ``,
      `${couple} ont la joie de vous inviter à célébrer leur mariage${dateStr ? ` le ${dateStr}` : ''}.`,
      ``,
      `Votre invitation : ${inv.invitationNumber}`,
      `Nombre de personnes autorisées : ${inv.maxPeople}`,
      ``,
      `Cliquez sur ce lien pour voir votre invitation et confirmer votre présence :`,
      link,
      ``,
      `Vous pouvez scanner le QR code joint pour accéder directement à votre page.`,
      ``,
      `Nous avons hâte de célébrer avec vous !`,
    ];
    return lines.join('\n');
  };

  const openSend = async (inv: Invitation) => {
    setSendInv(inv);
    setCopied(false);
    const url = await generateQrDataUrl(`${inv.invitationNumber}|${inv.qrToken}`);
    setSendQrUrl(url);
  };

  const sendWhatsApp = (inv: Invitation) => {
    const msg = invitationMessage(inv);
    let phone = inv.contactPhone?.replace(/[^0-9]/g, '') ?? '';
    if (phone && !phone.startsWith('0') && !phone.startsWith('+')) {
      // assume already international
    }
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const sendEmail = (inv: Invitation) => {
    const msg = invitationMessage(inv);
    const subject = settings
      ? `Invitation au mariage de ${settings.brideName} & ${settings.groomName}`
      : 'Invitation de mariage';
    const mailto = `mailto:${inv.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    window.location.href = mailto;
  };

  const copyLink = async (inv: Invitation) => {
    const link = invitationLink(inv);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      show('success', 'Lien copié dans le presse-papiers.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show('error', 'Impossible de copier le lien.');
    }
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      await generateQrInvitationsPdf();
      show('success', 'PDF des QR codes généré.');
    } catch (e) {
      show('error', 'Erreur lors de la génération du PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitations"
        subtitle={`${invitations.length} invitation(s) — ${invitations.reduce((s, i) => s + i.maxPeople, 0)} personnes autorisées`}
        icon={<Mail size={22} />}
        actions={
          <>
            <button onClick={exportPdf} disabled={pdfBusy || invitations.length === 0} className="btn-secondary">
              <Download size={18} /> QR PDF
            </button>
            <button onClick={openCreate} className="btn-primary">
              <Plus size={18} /> Nouvelle invitation
            </button>
          </>
        }
      />

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-10"
          placeholder="Rechercher par numéro ou nom de famille…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {invitations.length === 0 ? (
        <EmptyState
          icon={<Mail size={48} />}
          title="Aucune invitation pour le moment"
          description="Créez votre première invitation pour commencer à gérer vos invités."
          action={<button onClick={openCreate} className="btn-primary"><Plus size={18} /> Créer une invitation</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inv) => {
            const count = guestsByInv.get(inv.id) ?? 0;
            const rsvp = rsvpByInv.get(inv.id);
            return (
              <div key={inv.id} className="card-hover p-4 group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs text-gold-600 font-semibold">{inv.invitationNumber}</p>
                    <h3 className="mt-0.5 font-display text-lg font-semibold text-ink-800">{inv.familyName}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openSend(inv)} className="btn-icon" title="Envoyer l'invitation"><Send size={16} /></button>
                    <button onClick={() => openQr(inv)} className="btn-icon" title="QR code"><QrCode size={16} /></button>
                    <button onClick={() => openEdit(inv)} className="btn-icon" title="Modifier"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId(inv.id)} className="btn-icon hover:text-red-500" title="Supprimer"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm text-ink-500">
                  <span className="flex items-center gap-1"><UsersIcon size={14} /> {count}/{inv.maxPeople}</span>
                  <span className={
                    rsvp?.status === 'confirmed' ? 'badge-green' :
                    rsvp?.status === 'declined' ? 'badge-red' : 'badge-gray'
                  }>
                    {rsvp?.status === 'confirmed' ? 'Présent' : rsvp?.status === 'declined' ? 'Absent' : 'En attente'}
                  </span>
                </div>
                {inv.contactPhone && <p className="mt-2 text-xs text-ink-400">{inv.contactPhone}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Modifier ${editing.invitationNumber}` : 'Nouvelle invitation'}
        subtitle={editing ? editing.familyName : 'Créez une invitation avec un numéro et un QR code uniques'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn-primary" onClick={handleSubmit(onSubmit)}>Enregistrer</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nom de famille</label>
            <input className={`input ${errors.familyName ? 'input-error' : ''}`} placeholder="Ex : Kabeya" {...register('familyName', { required: 'Champ requis' })} />
            {errors.familyName && <p className="error-text">{errors.familyName.message}</p>}
          </div>
          <div>
            <label className="label">Nombre de personnes autorisées</label>
            <input type="number" min={1} max={50} className={`input ${errors.maxPeople ? 'input-error' : ''}`} {...register('maxPeople', { required: 'Champ requis', min: 1, valueAsNumber: true })} />
            {errors.maxPeople && <p className="error-text">{errors.maxPeople.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Téléphone (optionnel)</label>
              <input className="input" {...register('contactPhone')} />
            </div>
            <div>
              <label className="label">Email (optionnel)</label>
              <input className="input" {...register('email')} />
            </div>
          </div>
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          {!editing && (
            <p className="text-xs text-ink-400 bg-gold-50 rounded-lg p-3">
              Un numéro unique (INV-XXX) et un QR code seront générés automatiquement à l'enregistrement.
            </p>
          )}
        </div>
      </Modal>

      {/* QR modal */}
      <Modal
        open={!!qrInv}
        onClose={() => setQrInv(null)}
        title={qrInv?.invitationNumber}
        subtitle={qrInv?.familyName}
        size="sm"
      >
        {qrInv && (
          <div className="flex flex-col items-center gap-4">
            {qrUrl && <img src={qrUrl} alt="QR code" className="w-56 h-56 rounded-lg border border-ink-100" />}
            <p className="text-sm text-ink-500 text-center">
              Scannez ce QR code pour identifier rapidement l'invitation lors de l'accueil.
            </p>
            <p className="font-mono text-xs text-ink-400 break-all">{qrInv.qrToken}</p>
          </div>
        )}
      </Modal>

      {/* Send modal */}
      <Modal
        open={!!sendInv}
        onClose={() => setSendInv(null)}
        title="Envoyer l'invitation"
        subtitle={sendInv ? `${sendInv.invitationNumber} — ${sendInv.familyName}` : undefined}
      >
        {sendInv && (
          <div className="space-y-5">
            {/* QR code preview */}
            <div className="flex flex-col items-center gap-2">
              {sendQrUrl && (
                <img src={sendQrUrl} alt="QR code" className="w-40 h-40 rounded-lg border border-ink-100" />
              )}
              <p className="text-xs text-ink-400 text-center">
                Ce QR code sera inclus dans le message. L'invité le scanne pour accéder à sa page.
              </p>
            </div>

            {/* Invitation link */}
            <div>
              <label className="label">Lien de l'invitation</label>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 text-xs"
                  readOnly
                  value={invitationLink(sendInv)}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button onClick={() => copyLink(sendInv)} className="btn-secondary btn-sm shrink-0">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>

            {/* Message preview */}
            <div>
              <label className="label">Aperçu du message</label>
              <div className="rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-600 whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
                {invitationMessage(sendInv)}
              </div>
            </div>

            {/* Send buttons */}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => sendWhatsApp(sendInv)}
                className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-white font-medium transition-colors hover:bg-green-700"
              >
                <MessageCircle size={18} />
                {sendInv.contactPhone ? 'WhatsApp' : 'WhatsApp (sans numéro)'}
              </button>
              <button
                onClick={() => sendEmail(sendInv)}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium transition-colors hover:bg-blue-700"
              >
                <Mail size={18} />
                {sendInv.email ? 'Email' : 'Email (sans adresse)'}
              </button>
            </div>

            {(!sendInv.contactPhone && !sendInv.email) && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                Aucun numéro de téléphone ni email enregistré pour cette invitation. Ajoutez-les dans « Modifier » pour un envoi direct, ou copiez le lien pour le partager manuellement.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        title="Supprimer l'invitation"
        message="Cette action supprimera l'invitation, les invités associés et le RSVP. Cette opération est irréversible."
        confirmLabel="Supprimer"
      />
    </div>
  );
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}
