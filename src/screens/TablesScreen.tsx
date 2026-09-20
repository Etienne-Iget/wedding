import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Table2,
  Plus,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Circle,
  Square,
  RectangleHorizontal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useTables, useGuests } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import { uuid } from '@/lib/id';
import { tableOccupancy } from '@/lib/stats';
import type { TableEntity } from '@/types';

interface FormValues {
  name: string;
  capacity: number;
  shape: 'round' | 'rect' | 'square';
}

const shapeIcon = { round: Circle, square: Square, rect: RectangleHorizontal };

export function TablesScreen() {
  const tables = useTables();
  const guests = useGuests();
  const { show } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TableEntity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const occupancy = useMemo(() => tableOccupancy(tables, guests), [tables, guests]);
  const guestsByTable = useMemo(() => {
    const m = new Map<string, typeof guests>();
    for (const g of guests) {
      if (!g.tableId) continue;
      const arr = m.get(g.tableId) ?? [];
      arr.push(g);
      m.set(g.tableId, arr);
    }
    return m;
  }, [guests]);

  const openCreate = () => {
    setEditing(null);
    reset({ name: `Table ${tables.length + 1}`, capacity: 8, shape: 'round' });
    setShowForm(true);
  };

  const openEdit = (t: TableEntity) => {
    setEditing(t);
    reset({ name: t.name, capacity: t.capacity, shape: t.shape });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const now = Date.now();
    if (editing) {
      await db.weddingTables.put({ ...editing, name: values.name, capacity: values.capacity, shape: values.shape, updatedAt: now });
      show('success', 'Table mise à jour.');
    } else {
      await db.weddingTables.add({
        id: uuid(),
        name: values.name,
        capacity: values.capacity,
        shape: values.shape,
        x: 120 + (tables.length % 4) * 200,
        y: 120 + Math.floor(tables.length / 4) * 200,
        rotation: 0,
        color: null,
        createdAt: now,
        updatedAt: now,
      });
      show('success', 'Table créée.');
    }
    setShowForm(false);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    // unassign guests from deleted table
    const tableGuests = guests.filter((g) => g.tableId === deleteId);
    await db.transaction('rw', [db.weddingTables, db.guests], async () => {
      await db.weddingTables.delete(deleteId);
      for (const g of tableGuests) {
        await db.guests.put({ ...g, tableId: null, seatNumber: null });
      }
    });
    show('success', 'Table supprimée. Les invités ont été déplacés.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables & Places"
        subtitle={`${tables.length} table(s) — ${tables.reduce((s, t) => s + t.capacity, 0)} places au total`}
        icon={<Table2 size={22} />}
        actions={<button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nouvelle table</button>}
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={<Table2 size={48} />}
          title="Aucune table créée"
          description="Créez vos tables pour pouvoir attribuer des places à vos invités."
          action={<button onClick={openCreate} className="btn-primary"><Plus size={18} /> Créer une table</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occupancy.map(({ table, occupied, available, percent }) => {
            const Icon = shapeIcon[table.shape];
            const tableGuests = (guestsByTable.get(table.id) ?? []).sort((a, b) => (a.seatNumber ?? 999) - (b.seatNumber ?? 999));
            return (
              <div key={table.id} className="card-hover p-5 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink-800">{table.name}</h3>
                      <p className="text-xs text-ink-400">{table.shape === 'round' ? 'Ronde' : table.shape === 'square' ? 'Carrée' : 'Rectangulaire'} · {table.capacity} places</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(table)} className="btn-icon"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId(table.id)} className="btn-icon hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-ink-500">{occupied}/{table.capacity} occupées</span>
                    <span className={percent >= 100 ? 'text-red-500' : 'text-sage-600'}>{available} libres</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-red-400' : percent >= 80 ? 'bg-gold-500' : 'bg-sage-500'}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                {tableGuests.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-ink-100 pt-3">
                    {tableGuests.slice(0, 5).map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-xs text-ink-500">
                        <span>{g.firstName} {g.lastName}</span>
                        <span className="font-mono text-ink-400">P{g.seatNumber ?? '—'}</span>
                      </div>
                    ))}
                    {tableGuests.length > 5 && <p className="text-xs text-ink-400">+{tableGuests.length - 5} autres…</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Modifier la table' : 'Nouvelle table'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn-primary" onClick={handleSubmit(onSubmit)}>Enregistrer</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nom de la table</label>
            <input className={`input ${errors.name ? 'input-error' : ''}`} {...register('name', { required: 'Champ requis' })} />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Capacité (nombre de places)</label>
            <input type="number" min={1} max={50} className={`input ${errors.capacity ? 'input-error' : ''}`} {...register('capacity', { required: 'Champ requis', min: 1, valueAsNumber: true })} />
            {errors.capacity && <p className="error-text">{errors.capacity.message}</p>}
          </div>
          <div>
            <label className="label">Forme</label>
            <div className="grid grid-cols-3 gap-2">
              {(['round', 'square', 'rect'] as const).map((s) => {
                const Icon = shapeIcon[s];
                const labels = { round: 'Ronde', square: 'Carrée', rect: 'Rectangulaire' };
                return (
                  <label key={s} className="flex flex-col items-center gap-2 rounded-lg border border-ink-200 p-3 cursor-pointer hover:border-gold-300 has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50 transition-colors">
                    <input type="radio" value={s} className="sr-only" {...register('shape')} />
                    <Icon size={22} className="text-ink-500" />
                    <span className="text-xs text-ink-600">{labels[s]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        title="Supprimer cette table"
        message="Les invités assignés à cette table perdront leur place. Vous pourrez les réassigner ensuite."
        confirmLabel="Supprimer"
      />
    </div>
  );
}
