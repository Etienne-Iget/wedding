import { useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { LayoutGrid as FloorPlanIcon, Save, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useTables, useGuests } from '@/hooks/useLiveData';
import { db } from '@/db/database';
import type { TableEntity } from '@/types';

const TABLE_SIZE = { round: 88, square: 84, rect: 120 };

export function FloorPlanScreen() {
  const tables = useTables();
  const guests = useGuests();
  const { show } = useToast();
  const [selected, setSelected] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const guestsByTable = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) {
      if (g.tableId) m.set(g.tableId, (m.get(g.tableId) ?? 0) + 1);
    }
    return m;
  }, [guests]);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const delta = e.delta;
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    const table = tables.find((t) => t.id === id);
    if (!table) return;
    await db.weddingTables.put({
      ...table,
      x: Math.max(20, table.x + delta.x),
      y: Math.max(20, table.y + delta.y),
      updatedAt: Date.now(),
    });
  };

  const selectedTable = tables.find((t) => t.id === selected);
  const selectedGuests = selectedTable
    ? guests
        .filter((g) => g.tableId === selectedTable.id)
        .sort((a, b) => (a.seatNumber ?? 999) - (b.seatNumber ?? 999))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de salle"
        subtitle="Glissez-déposez les tables pour organiser votre salle"
        icon={<FloorPlanIcon size={22} />}
        actions={
          <p className="text-xs text-ink-400 flex items-center gap-1.5">
            <Save size={14} /> Sauvegarde automatique
          </p>
        }
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={<FloorPlanIcon size={48} />}
          title="Aucune table à placer"
          description="Créez d'abord vos tables dans l'écran « Tables & Places », puis revenez ici pour organiser le plan de salle."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Canvas */}
          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink-700">Salle</h3>
              <span className="text-xs text-ink-400">{tables.length} tables</span>
            </div>
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div
                className="relative bg-[radial-gradient(circle,#e8e3d8_1px,transparent_1px)] bg-[length:24px_24px] bg-cream overflow-auto scrollbar-thin"
                style={{ minHeight: 600, backgroundImage: 'radial-gradient(circle, #e8e3d8 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              >
                <div className="relative" style={{ width: 1200, height: 700 }}>
                  {tables.map((t) => {
                    const size = TABLE_SIZE[t.shape];
                    const w = t.shape === 'rect' ? 120 : size;
                    const h = t.shape === 'rect' ? 64 : size;
                    const occupied = guestsByTable.get(t.id) ?? 0;
                    const isSel = selected === t.id;
                    const full = occupied >= t.capacity;
                    return (
                      <DraggableTable
                        key={t.id}
                        table={t}
                        width={w}
                        height={h}
                        occupied={occupied}
                        selected={isSel}
                        onSelect={() => setSelected(isSel ? null : t.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </DndContext>
          </div>

          {/* Side panel */}
          <div className="card p-5 h-fit">
            {!selectedTable ? (
              <div className="text-center py-8">
                <FloorPlanIcon size={32} className="mx-auto text-ink-300" />
                <p className="mt-2 text-sm text-ink-400">Cliquez sur une table pour voir les invités assignés.</p>
              </div>
            ) : (
              <div>
                <div className="border-b border-ink-100 pb-3 mb-3">
                  <h3 className="font-display text-lg font-semibold text-ink-800">{selectedTable.name}</h3>
                  <p className="text-xs text-ink-400">
                    {selectedTable.shape === 'round' ? 'Ronde' : selectedTable.shape === 'square' ? 'Carrée' : 'Rectangulaire'} · {selectedTable.capacity} places
                  </p>
                  <p className="text-xs mt-1">
                    <span className={full(selectedGuests.length, selectedTable.capacity) ? 'text-red-500' : 'text-sage-600'}>
                      {selectedGuests.length}/{selectedTable.capacity} occupées
                    </span>
                  </p>
                </div>
                {selectedGuests.length === 0 ? (
                  <p className="text-sm text-ink-400 py-4 text-center">Aucun invité assigné.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedGuests.map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-700">{g.firstName} {g.lastName}</span>
                        <span className="font-mono text-xs text-ink-400">Place {g.seatNumber ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-ink-100">
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <UsersIcon size={12} /> Assignez les places depuis l'écran Invités.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function full(occupied: number, capacity: number): boolean {
  return occupied >= capacity;
}

import { useDraggable } from '@dnd-kit/core';

function DraggableTable({
  table,
  width,
  height,
  occupied,
  selected,
  onSelect,
}: {
  table: TableEntity;
  width: number;
  height: number;
  occupied: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: table.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: table.x,
    top: table.y,
    width,
    height,
    zIndex: isDragging ? 50 : selected ? 10 : 1,
  };
  const fullTable = occupied >= table.capacity;
  const radius = table.shape === 'round' ? '9999px' : table.shape === 'square' ? '8px' : '8px';

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-shadow ${
        selected ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-cream' : ''
      } ${isDragging ? 'shadow-lift' : 'shadow-card'}`}
      title={`${table.name} — ${occupied}/${table.capacity}`}
    >
      <div
        className={`flex flex-col items-center justify-center border-2 ${
          fullTable ? 'border-red-300 bg-red-50' : selected ? 'border-gold-400 bg-gold-50' : 'border-gold-300 bg-white'
        } hover:border-gold-500 transition-colors`}
        style={{ width: '100%', height: '100%', borderRadius: radius }}
      >
        <span className="text-xs font-semibold text-ink-800 leading-tight px-1 text-center truncate max-w-full">{table.name}</span>
        <span className={`text-[10px] ${fullTable ? 'text-red-500' : 'text-ink-400'}`}>{occupied}/{table.capacity}</span>
      </div>
    </button>
  );
}
