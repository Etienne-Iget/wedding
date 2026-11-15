import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Wine,
  Plus,
  Printer,
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
import { useBeverages, useGuests, useSettings } from '@/hooks/useLiveData';
import { useStore } from '@/store/StoreContext';
import { uuid } from '@/lib/id';
import { beverageOrderLines, DRINKS_PER_GUEST } from '@/lib/beverageOrder';
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
  const { addBeverage, updateBeverage, deleteBeverage } = useStore();
  const settings = useSettings();
  const orderLines = useMemo(() => beverageOrderLines(beverages, guests), [beverages, guests]);
  const orderTotal = orderLines.reduce((sum, l) => sum + l.quantity, 0);
  const orderToBuy = orderLines.reduce((sum, l) => sum + l.toOrder, 0);
  const drinksPlanned = guests.length * DRINKS_PER_GUEST;
  const drinksRemaining = Math.max(0, drinksPlanned - orderTotal);

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
      updateBeverage({ ...editing, name: values.name, category: values.category, isAlcoholic: values.isAlcoholic, stock, notes: values.notes || undefined, updatedAt: now });
      show('success', 'Boisson mise à jour.');
    } else {
      addBeverage({ id: uuid(), name: values.name, category: values.category, isAlcoholic: values.isAlcoholic, stock, notes: values.notes || undefined, createdAt: now, updatedAt: now });
      show('success', 'Boisson ajoutée.');
    }
    setShowForm(false);
  };

  const onDelete = () => {
    if (!deleteId) return;
    deleteBeverage(deleteId);
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

      <section className="card p-6">
        <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink-800">Bon de commande</h3>
            <p className="text-sm text-ink-400">Total des boissons choisies par les invités</p>
          </div>
          <button onClick={() => window.print()} disabled={orderLines.length === 0} className="btn-secondary">
            <Printer size={18} /> Imprimer le bon
          </button>
        </div>

        <div id="beverage-order-print">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">Bon de commande boissons</p>
            {settings && (
              <p className="mt-1 font-display text-2xl text-ink-800">{settings.brideName} &amp; {settings.groomName}</p>
            )}
            {settings && (
              <p className="text-sm text-ink-500">
                {new Date(settings.weddingDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wider text-ink-500">Invités</p>
              <p className="mt-1 text-2xl font-semibold text-ink-800">{guests.length}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wider text-ink-500">Boissons prévues</p>
              <p className="mt-1 text-2xl font-semibold text-ink-800">{drinksPlanned}</p>
              <p className="text-xs text-ink-400">{DRINKS_PER_GUEST} par invité</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wider text-ink-500">Boissons choisies</p>
              <p className="mt-1 text-2xl font-semibold text-gold-700">{orderTotal}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wider text-ink-500">Reste à choisir</p>
              <p className="mt-1 text-2xl font-semibold text-ink-800">{drinksRemaining}</p>
            </div>
          </div>

          {orderLines.length === 0 ? (
            <p className="text-sm text-ink-400">Aucune boisson choisie pour le moment.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-100">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Boisson</th>
                    <th className="px-4 py-3 font-medium">Catégorie</th>
                    <th className="px-4 py-3 font-medium text-right">Quantité choisie</th>
                    <th className="px-4 py-3 font-medium text-right">En stock</th>
                    <th className="px-4 py-3 font-medium text-right">À commander</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {orderLines.map((l) => (
                    <tr key={l.beverage.id}>
                      <td className="px-4 py-3 font-medium text-ink-800">{l.beverage.name}</td>
                      <td className="px-4 py-3 text-ink-600">{categoryLabels[l.beverage.category]}</td>
                      <td className="px-4 py-3 text-right text-ink-700">{l.quantity}</td>
                      <td className="px-4 py-3 text-right text-ink-600">{l.beverage.stock ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gold-700">{l.toOrder}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink-200 bg-ink-50 text-sm">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink-800" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-800">{orderTotal}</td>
                    <td />
                    <td className="px-4 py-3 text-right font-semibold text-gold-700">{orderToBuy}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

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
