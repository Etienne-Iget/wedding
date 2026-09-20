import { db } from '@/db/database';
import type { Beverage, Guest, Invitation, Rsvp, TableEntity } from '@/types';
import { downloadText } from './backup';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

export async function exportGuestsCsv(): Promise<void> {
  const [guests, invitations, tables, rsvps, beverages] = await Promise.all([
    db.guests.toArray(),
    db.invitations.toArray(),
    db.weddingTables.toArray(),
    db.rsvps.toArray(),
    db.beverages.toArray(),
  ]);

  const invById = new Map(invitations.map((i) => [i.id, i]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const rsvpByInv = new Map(rsvps.map((r) => [r.invitationId, r]));
  const bevById = new Map(beverages.map((b) => [b.id, b]));

  const header = ['invitation_number', 'family_name', 'first_name', 'table', 'seat', 'rsvp', 'beverage'];
  const rows: (string | number)[][] = [header];

  for (const g of guests) {
    const inv = invById.get(g.invitationId);
    const table = g.tableId ? tableById.get(g.tableId) : undefined;
    const rsvp = inv ? rsvpByInv.get(inv.id) : undefined;
    const bev = g.beverageId ? bevById.get(g.beverageId) : undefined;
    rows.push([
      inv?.invitationNumber ?? '',
      inv?.familyName ?? '',
      g.firstName,
      table?.name ?? '',
      g.seatNumber ?? '',
      rsvp?.status ?? 'pending',
      bev?.name ?? '',
    ]);
  }

  downloadText('invites.csv', rowsToCsv(rows), 'text/csv');
}

export async function exportBeveragesCsv(): Promise<void> {
  const [guests, invitations, tables, beverages] = await Promise.all([
    db.guests.toArray(),
    db.invitations.toArray(),
    db.weddingTables.toArray(),
    db.beverages.toArray(),
  ]);

  const invById = new Map(invitations.map((i) => [i.id, i]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const bevById = new Map(beverages.map((b) => [b.id, b]));

  const header = ['guest', 'table', 'seat', 'beverage', 'quantity'];
  const rows: (string | number)[][] = [header];

  for (const g of guests) {
    if (!g.beverageId) continue;
    const inv = invById.get(g.invitationId);
    const table = g.tableId ? tableById.get(g.tableId) : undefined;
    const bev = bevById.get(g.beverageId);
    rows.push([
      `${g.firstName} ${g.lastName}`.trim(),
      table?.name ?? '',
      g.seatNumber ?? '',
      bev?.name ?? '',
      g.beverageQuantity ?? 1,
    ]);
  }

  downloadText('boissons.csv', rowsToCsv(rows), 'text/csv');
}

export async function exportTablesCsv(): Promise<void> {
  const [tables, guests] = await Promise.all([
    db.weddingTables.toArray(),
    db.guests.toArray(),
  ]);

  const header = ['table', 'capacity', 'occupied', 'available'];
  const rows: (string | number)[][] = [header];

  for (const t of tables) {
    const occupied = guests.filter((g) => g.tableId === t.id).length;
    rows.push([t.name, t.capacity, occupied, Math.max(0, t.capacity - occupied)]);
  }

  downloadText('tables.csv', rowsToCsv(rows), 'text/csv');
}

// Aggregate beverage quantities for planning.
export async function beverageSummary(): Promise<Array<{ name: string; category: string; total: number }>> {
  const [guests, beverages] = await Promise.all([
    db.guests.toArray(),
    db.beverages.toArray(),
  ]);
  const bevById = new Map(beverages.map((b) => [b.id, b]));
  const totals = new Map<string, number>();
  for (const g of guests) {
    if (!g.beverageId) continue;
    const bev = bevById.get(g.beverageId);
    if (!bev) continue;
    const qty = g.beverageQuantity ?? 1;
    totals.set(bev.name, (totals.get(bev.name) ?? 0) + qty);
  }
  return Array.from(totals.entries()).map(([name, total]) => ({
    name,
    category: bevById.get(beverages.find((b) => b.name === name)?.id ?? '')?.category ?? 'other',
    total,
  }));
}
