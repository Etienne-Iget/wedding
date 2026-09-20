import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Baby,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useInvitations, useGuests, useTables, useBeverages, useSettings } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import { uuid } from '@/lib/id';
import type { Guest } from '@/types';

interface FormValues {
  invitationId: string;
  firstName: string;
  lastName: string;
  tableId: string;
  seatNumber: number | '';
  beverageId: string;
  isChild: boolean;
}

export function GuestsScreen() {
  const invitations = useInvitations();
  const guests = useGuests();
  const tables = useTables();
  const beverages = useBeverages();
  const settings = useSettings();
  const { show } = useToast();

  const [search, setSearch] = useState('');
  const [filterInv, setFilterInv] = useState('');
  const [editing, setEditing] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>();

  const invById = useMemo(() => new Map(invitations.map((i) => [i.id, i])), [invitations]);
  const tableById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const bevById = useMemo(() => new Map(beverages.map((b) => [b.id, b])), [beverages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests
      .filter((g) => {
        if (filterInv && g.invitationId !== filterInv) return false;
        if (!q) return true;
        const inv = invById.get(g.invitationId);
        return (
          g.firstName.toLowerCase().includes(q) ||
          g.lastName.toLowerCase().includes(q) ||
          inv?.familyName.toLowerCase().includes(q) ||
          inv?.invitationNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const fa = invById.get(a.invitationId)?.familyName ?? '';
        const fb = invById.get(b.invitationId)?.familyName ?? '';
        return fa.localeCompare(fb) || a.firstName.localeCompare(b.firstName);
      });
  }, [guests, search, filterInv, invById]);

  const openCreate = () => {
    setEditing(null);
    reset({ invitationId: invitations[0]?.id ?? '', firstName: '', lastName: '', tableId: '', seatNumber: '', beverageId: '', isChild: false });
    setShowForm(true);
  };

  const openEdit = (g: Guest) => {
    setEditing(g);
    reset({
      invitationId: g.invitationId,
      firstName: g.firstName,
      lastName: g.lastName,
      tableId: g.tableId ?? '',
      seatNumber: g.seatNumber ?? '',
      beverageId: g.beverageId ?? '',
      isChild: g.isChild,
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const now = Date.now();
    const inv = invById.get(values.invitationId);
    if (!inv) { show('error', 'Veuillez sélectionner une invitation.'); return; }

    // enforce max people cap
    const siblings = guests.filter((x) => x.invitationId === values.invitationId && x.id !== editing?.id);
    if (siblings.length + 1 > inv.maxPeople) {
      show('error', `Cette invitation autorise ${inv.maxPeople} personnes maximum.`);
      return;
    }

    const seat = values.seatNumber === '' ? null : Number(values.seatNumber);
    const tableId = values.tableId || null;
    const beverageId = values.beverageId || null;

    if (editing) {
      await db.guests.put({
        ...editing,
        invitationId: values.invitationId,
        firstName: values.firstName,
        lastName: values.lastName,
        tableId,
        seatNumber: seat,
        beverageId,
        isChild: values.isChild,
        updatedAt: now,
      });
      show('success', 'Invité mis à jour.');
    } else {
      await db.guests.add({
        id: uuid(),
        invitationId: values.invitationId,
        firstName: values.firstName,
        lastName: values.lastName,
        tableId,
        seatNumber: seat,
        beverageId,
        beverageQuantity: beverageId ? 1 : null,
        isChild: values.isChild,
        createdAt: now,
        updatedAt: now,
      });
      show('success', 'Invité ajouté.');
    }
    setShowForm(false);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await db.guests.delete(deleteId);
    show('success', 'Invité supprimé.');
  };

  const totalCap = settings?.maxGuests ?? 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invités"
        subtitle={`${guests.length} enregistrés — capacité max ${totalCap}`}
        icon={<Users size={22} />}
        actions={
          <button onClick={openCreate} disabled={invitations.length === 0} className="btn-primary">
            <Plus size={18} /> Ajouter un invité
          </button>
        }
      />

      {invitations.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="Créez d'abord une invitation"
          description="Les invités doivent être rattachés à une invitation. Commencez par l'écran Invitations."
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-10" placeholder="Rechercher un nom…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input sm:w-64" value={filterInv} onChange={(e) => setFilterInv(e.target.value)}>
              <option value="">Toutes les invitations</option>
              {invitations.map((i) => (
                <option key={i.id} value={i.id}>{i.invitationNumber} — {i.familyName}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="Aucun invité trouvé" description="Modifiez votre recherche ou ajoutez un nouvel invité." />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invitation</th>
                      <th className="px-4 py-3 font-medium">Famille</th>
                      <th className="px-4 py-3 font-medium">Nom</th>
                      <th className="px-4 py-3 font-medium">Table</th>
                      <th className="px-4 py-3 font-medium">Place</th>
                      <th className="px-4 py-3 font-medium">Boisson</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filtered.map((g) => {
                      const inv = invById.get(g.invitationId);
                      const table = g.tableId ? tableById.get(g.tableId) : undefined;
                      const bev = g.beverageId ? bevById.get(g.beverageId) : undefined;
                      return (
                        <tr key={g.id} className="hover:bg-gold-50/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gold-600">{inv?.invitationNumber}</td>
                          <td className="px-4 py-3 text-ink-600">{inv?.familyName}</td>
                          <td className="px-4 py-3 font-medium text-ink-800">
                            {g.firstName} {g.lastName}
                            {g.isChild && <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-blue-500"><Baby size={12} /> enfant</span>}
                          </td>
                          <td className="px-4 py-3 text-ink-600">{table?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-ink-600">{g.seatNumber ?? '—'}</td>
                          <td className="px-4 py-3 text-ink-600">{bev?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(g)} className="btn-icon"><Pencil size={16} /></button>
                            <button onClick={() => setDeleteId(g.id)} className="btn-icon hover:text-red-500"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Modifier un invité' : 'Ajouter un invité'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn-primary" onClick={handleSubmit(onSubmit)}>Enregistrer</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Invitation</label>
            <select className={`input ${errors.invitationId ? 'input-error' : ''}`} {...register('invitationId', { required: 'Champ requis' })}>
              <option value="">Sélectionner…</option>
              {invitations.map((i) => (
                <option key={i.id} value={i.id}>{i.invitationNumber} — {i.familyName}</option>
              ))}
            </select>
            {errors.invitationId && <p className="error-text">{errors.invitationId.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Prénom</label>
              <input className={`input ${errors.firstName ? 'input-error' : ''}`} {...register('firstName', { required: 'Champ requis' })} />
              {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Nom</label>
              <input className={`input ${errors.lastName ? 'input-error' : ''}`} {...register('lastName', { required: 'Champ requis' })} />
              {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Table</label>
              <select className="input" {...register('tableId')}>
                <option value="">Aucune</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.capacity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">N° de place</label>
              <input type="number" min={1} className="input" placeholder="Ex : 3" {...register('seatNumber', { setValueAs: (v) => v === '' ? '' : Number(v) })} />
            </div>
          </div>
          <div>
            <label className="label">Boisson</label>
            <select className="input" {...register('beverageId')}>
              <option value="">Aucune</option>
              {beverages.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-300" {...register('isChild')} />
            Enfant
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        title="Supprimer cet invité"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
      />
    </div>
  );
}
