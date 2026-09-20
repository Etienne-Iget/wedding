import type { Guest, Invitation, Rsvp, TableEntity } from '@/types';

export interface WeddingStats {
  totalInvitations: number;
  totalGuestsRegistered: number;
  maxGuestsAllowed: number;
  totalPeopleAuthorized: number;
  confirmedCount: number;
  declinedCount: number;
  pendingCount: number;
  totalAttending: number;
  tablesCount: number;
  seatedCount: number;
  unseatedCount: number;
  totalCapacity: number;
  beverageSelections: number;
}

export function computeStats(
  invitations: Invitation[],
  guests: Guest[],
  rsvps: Rsvp[],
  tables: TableEntity[],
  maxGuests: number
): WeddingStats {
  const rsvpByInv = new Map(rsvps.map((r) => [r.invitationId, r]));
  let confirmed = 0;
  let declined = 0;
  let pending = 0;
  let attending = 0;

  for (const inv of invitations) {
    const r = rsvpByInv.get(inv.id);
    if (!r || r.status === 'pending') pending++;
    else if (r.status === 'confirmed') {
      confirmed++;
      attending += r.attendingCount;
    } else declined++;
  }

  const totalPeopleAuthorized = invitations.reduce((s, i) => s + i.maxPeople, 0);
  const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);
  const seatedCount = guests.filter((g) => g.tableId).length;
  const beverageSelections = guests.filter((g) => g.beverageId).length;

  return {
    totalInvitations: invitations.length,
    totalGuestsRegistered: guests.length,
    maxGuestsAllowed: maxGuests,
    totalPeopleAuthorized,
    confirmedCount: confirmed,
    declinedCount: declined,
    pendingCount: pending,
    totalAttending: attending,
    tablesCount: tables.length,
    seatedCount,
    unseatedCount: guests.length - seatedCount,
    totalCapacity,
    beverageSelections,
  };
}

export function tableOccupancy(tables: TableEntity[], guests: Guest[]) {
  return tables.map((t) => {
    const occupied = guests.filter((g) => g.tableId === t.id).length;
    return {
      table: t,
      occupied,
      available: Math.max(0, t.capacity - occupied),
      percent: t.capacity > 0 ? Math.round((occupied / t.capacity) * 100) : 0,
    };
  });
}
