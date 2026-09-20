import { useStore } from '@/store/StoreContext';
import type { WeddingSettings, Invitation, Guest, TableEntity, Beverage, Rsvp } from '@/types';

export function useSettings(): WeddingSettings | undefined {
  return useStore().settings ?? undefined;
}

export function useInvitations(): Invitation[] {
  return useStore().invitations;
}

export function useGuests(): Guest[] {
  return useStore().guests;
}

export function useTables(): TableEntity[] {
  return useStore().tables;
}

export function useBeverages(): Beverage[] {
  return useStore().beverages;
}

export function useRsvps(): Rsvp[] {
  return useStore().rsvps;
}
