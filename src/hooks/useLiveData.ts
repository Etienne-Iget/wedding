import { useLiveQuery } from 'dexie-react-hooks';
import { db, SETTINGS_ID } from '@/db/database';
import type { WeddingSettings, Invitation, Guest, TableEntity, Beverage, Rsvp } from '@/types';

export function useSettings(): WeddingSettings | undefined {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), [], undefined);
}

export function useInvitations(): Invitation[] {
  return useLiveQuery(() => db.invitations.orderBy('invitationNumber').toArray(), [], []) ?? [];
}

export function useGuests(): Guest[] {
  return useLiveQuery(() => db.guests.toArray(), [], []) ?? [];
}

export function useTables(): TableEntity[] {
  return useLiveQuery(() => db.weddingTables.toArray(), [], []) ?? [];
}

export function useBeverages(): Beverage[] {
  return useLiveQuery(() => db.beverages.toArray(), [], []) ?? [];
}

export function useRsvps(): Rsvp[] {
  return useLiveQuery(() => db.rsvps.toArray(), [], []) ?? [];
}
