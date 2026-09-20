import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Wine,
  Plus,
  Pencil,
  Trash2,
  Grape,
  Beer,
  GlassWater,
  CupSoda,
  GlassWater as GlassWaterAlt,
  Martini,
  Coffee,
  GlassWater as OtherIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useBeverages, useGuests } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import { uuid } from '@/lib/id';
import type { Beverage } from '@/types';

type Category = Beverage['category'];

interface FormValues {
  name: string;
  category: Category;
  isAlcoholic: boolean;
  stock: number | '';
  notes: string;
}

const categoryLabels: Record<Category, string> = {
  soft: 'Soft',
  wine: 'Vin',
  beer: 'Bière',
  champagne: 'Champagne',
  water: 'Eau',
  juice: 'Jus',
  cocktail: 'Cocktail',
  other: 'Autre',
};

const categoryIcon: Record<Category, React.ComponentType<{ size?: number | string; className?: string }>> = {
  soft: CupSoda,
  wine: Grape,
  beer: Beer,
  champagne: Wine,
  water: GlassWater,
  juice: CupSoda,
  cocktail: Martini,
  other: OtherIcon,
};

const categoryColors: Record<Category, string> = {
  soft: 'bg-blue-100 text-blue-600',
  wine: 'bg-red-100 text-red-600',
  beer: 'bg-amber-100 text-amber-600',
  champagne: 'bg-gold-100 text-gold-600',
  water: 'bg-cyan-100 text-cyan-600',
  juice: 'bg-orange-100 text-orange-600',
  cocktail: 'bg-blush-400/30 text-blush-500',
  other: 'bg-ink-100 text-ink-500',
};

export function BeveragesScreen() {
  const beverages = useBeverages();
  const guests = useGuests();
  const { show } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const selectionCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) {
      if (!g.beverageId) continue;
      m.set(g.beverageId, (m.get(g.beverageId) ?? 0) + (g.beverageQuantity ?? 1));
    }
    return m;
  }, [guests]);

  const grouped = useMemo(() => {
    const m = new Map<Category, Beverage[]>();
    for (const b of beverages) {
      const arr = m.get(b.category) ?? [];
      arr.push(b);
      m.set(b.category, arr);
    }
    return m;
  }, [beverages]);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', category: 'soft', isAlcoholic: false, stock: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (b: Beverage) => {
    setEditing(b);
    reset({ name: b.name, category: b.category, isAlcoholic: b.isAlcoholic, stock: b.stock ?? '', notes: b.notes ?? '' });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const now = Date.now();
    const stock = values.stock === '' ? null : Number(values.stock);
    if (editing) {
      await db.beverages.put({ ...editing, name: values.name, category: values.category, isAlcoholic: values.isAlcoholic, stock, notes: values.notes || undefined, updatedAt: now });
      show('success', 'Boisson mise à jour.');
    } else {
      await db.beverages.add({ id: uuid(), name: values.name, category: values.category, isAlcoholic: values.isAlcoholic, stock, notes: values.notes || undefined, createdAt: now, updatedAt: now });
      show('success', 'Boisson ajoutée.');
    }
    setShowForm(false);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    // clear beverage selection on guests
    const usingGuests = guests.filter((g) => g.beverageId === deleteId);
    await db.transaction('rw', [db.beverages, db.guests], async () => {
      await db.beverages.delete(deleteId);
      for (const g of usingGuests) {
        await db.guests.put({ ...g, beverageId: null, beverageQuantity: null });
      }
    });
    show('success', 'Boisson supprimée.');
  };

  const categories = Object.keys(categoryLabels) as Category[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boissons"
        subtitle={`${beverages.length} boisson(s) — ${guests.filter((g) => g.beverageId).length} sélections d'invités`}
        icon={<Wine size={22} />}
        actions={<button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nouvelle boisson</button>}
      />

      {beverages.length === 0 ? (
        <EmptyState
          icon={<Wine size={48} />}
          title="Aucune boisson enregistrée"
          description="Ajoutez les boissons disponibles pour permettre aux invités de faire leur choix."
          action={<button onClick={openCreate} className="btn-primary"><Plus size={18} /> Ajouter une boisson</button>}
        />
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const list = grouped.get(cat);
            if (!list || list.length === 0) return null;
            const Icon = categoryIcon[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className="text-ink-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">{categoryLabels[cat]}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((b) => {
                    const IconB = categoryIcon[b.category];
                    const count = selectionCount.get(b.id) ?? 0;
                    return (
                      <div key={b.id} className="card-hover p-4 group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[b.category]}`}>
                              <IconB size={20} />
                            </div>
                            <div>
                              <h4 className="font-medium text-ink-800">{b.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                {b.isAlcoholic && <span className="badge-red text-[10px]">Alcool</span>}
                                {b.stock != null && <span className="text-xs text-ink-400">Stock: {b.stock}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(b)} className="btn-icon"><Pencil size={16} /></button>
                            <button onClick={() => setDeleteId(b.id)} className="btn-icon hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm border-t border-ink-100 pt-2">
                          <span className="text-ink-400 text-xs">Choisie par</span>
                          <span className="font-medium text-gold-600">{count} pers.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Modifier la boisson' : 'Nouvelle boisson'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn-primary" onClick={handleSubmit(onSubmit)}>Enregistrer</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input className={`input ${errors.name ? 'input-error' : ''}`} placeholder="Ex : Coca-Cola" {...register('name', { required: 'Champ requis' })} />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" {...register('category')}>
              {categories.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Stock (optionnel)</label>
              <input type="number" min={0} className="input" placeholder="Ex : 30" {...register('stock', { setValueAs: (v) => v === '' ? '' : Number(v) })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-300" {...register('isAlcoholic')} />
                Alcoolisée
              </label>
            </div>
          </div>
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        title="Supprimer cette boisson"
        message="Les invités ayant choisi cette boisson perdront leur sélection."
        confirmLabel="Supprimer"
      />
    </div>
  );
}
