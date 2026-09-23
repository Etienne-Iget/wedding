import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  WeddingSettings,
  Invitation,
  Guest,
  Rsvp,
  TableEntity,
  Beverage,
  WeddingData,
} from '@/types';
import { CURRENT_SCHEMA_VERSION, APPLICATION_NAME } from '@/types';

const DATA_URL = '/data/wedding-data.json';
const SAVE_URL = '/api/save';
const LOAD_URL = '/api/load';

interface StoreState {
  settings: WeddingSettings | null;
  invitations: Invitation[];
  guests: Guest[];
  rsvps: Rsvp[];
  tables: TableEntity[];
  beverages: Beverage[];
  loaded: boolean;
  isDirty: boolean;
}

interface StoreValue extends StoreState {
  updateSettings: (settings: WeddingSettings) => void;
  addInvitation: (inv: Invitation) => void;
  updateInvitation: (inv: Invitation) => void;
  deleteInvitation: (id: string) => void;
  addGuest: (g: Guest) => void;
  updateGuest: (g: Guest) => void;
  deleteGuest: (id: string) => void;
  upsertRsvp: (rsvp: Rsvp) => void;
  mergeRsvps: (list: Rsvp[]) => number;
  addTable: (t: TableEntity) => void;
  updateTable: (t: TableEntity) => void;
  deleteTable: (id: string) => void;
  addBeverage: (b: Beverage) => void;
  updateBeverage: (b: Beverage) => void;
  deleteBeverage: (id: string) => void;
  replaceAll: (data: WeddingData) => void;
  mergeAll: (data: WeddingData) => void;
  buildWeddingData: () => WeddingData;
  resetToPublished: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const emptyState: StoreState = {
  settings: null,
  invitations: [],
  guests: [],
  rsvps: [],
  tables: [],
  beverages: [],
  loaded: false,
  isDirty: false,
};

function dataToState(data: WeddingData, isDirty: boolean): StoreState {
  return {
    settings: data.settings,
    invitations: data.invitations ?? [],
    guests: data.guests ?? [],
    rsvps: data.rsvps ?? [],
    tables: data.tables ?? [],
    beverages: data.beverages ?? [],
    loaded: true,
    isDirty,
  };
}

function stateToData(state: StoreState): WeddingData {
  return {
    version: CURRENT_SCHEMA_VERSION,
    weddingId: state.settings?.weddingId ?? 'mariage',
    exportedAt: new Date().toISOString(),
    settings: state.settings ?? defaultSettings(),
    invitations: state.invitations,
    guests: state.guests,
    rsvps: state.rsvps,
    tables: state.tables,
    beverages: state.beverages,
  };
}

function defaultSettings(): WeddingSettings {
  return {
    id: 'current',
    weddingId: 'etienne-hannah-2026',
    applicationName: APPLICATION_NAME,
    brideName: 'Hannah',
    groomName: 'Étienne',
    weddingDate: '2026-09-12',
    venueName: '',
    venueAddress: '',
    maxGuests: 100,
    contactEmail: '',
    currency: 'EUR',
    primaryColor: '#b8860b',
    logoSrc: null,
    heroPhotoSrc: null,
    events: {
      dot: { date: '', time: '', venueName: '', venueAddress: '' },
      civil: { date: '', time: '', venueName: '', venueAddress: '' },
      religious: { date: '', time: '', venueName: '', venueAddress: '' },
    },
    updatedAt: 0,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(emptyState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(LOAD_URL, { cache: 'no-cache' });
        if (res.ok) {
          const data: WeddingData = await res.json();
          setState(dataToState(data, false));
          return;
        }
        const fallback = await fetch(DATA_URL, { cache: 'no-cache' });
        const published: WeddingData = await fallback.json();
        setState(dataToState(published, false));
      } catch {
        const fallback = await fetch(DATA_URL, { cache: 'no-cache' }).catch(() => null);
        if (fallback?.ok) {
          const published: WeddingData = await fallback.json();
          setState(dataToState(published, false));
        } else {
          setState(dataToState(stateToData(emptyState), false));
        }
      }
    })();
  }, []);

  const persist = (next: StoreState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const data = stateToData(next);
      try {
        await fetch(SAVE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {
        // dev server unavailable — silently ignore
      }
    }, 300);
  };

  const mutate = (updater: (prev: StoreState) => StoreState) => {
    setState((prev) => {
      const next = { ...updater(prev), isDirty: true, loaded: true };
      persist(next);
      return next;
    });
  };

  const updateSettings = (settings: WeddingSettings) =>
    mutate((prev) => ({ ...prev, settings }));

  const addInvitation = (inv: Invitation) =>
    mutate((prev) => ({ ...prev, invitations: [...prev.invitations, inv] }));

  const updateInvitation = (inv: Invitation) =>
    mutate((prev) => ({
      ...prev,
      invitations: prev.invitations.map((i) => (i.id === inv.id ? inv : i)),
    }));

  const deleteInvitation = (id: string) =>
    mutate((prev) => ({
      ...prev,
      invitations: prev.invitations.filter((i) => i.id !== id),
      guests: prev.guests.filter((g) => g.invitationId !== id),
      rsvps: prev.rsvps.filter((r) => r.invitationId !== id),
    }));

  const addGuest = (g: Guest) =>
    mutate((prev) => ({ ...prev, guests: [...prev.guests, g] }));

  const updateGuest = (g: Guest) =>
    mutate((prev) => ({
      ...prev,
      guests: prev.guests.map((x) => (x.id === g.id ? g : x)),
    }));

  const deleteGuest = (id: string) =>
    mutate((prev) => ({ ...prev, guests: prev.guests.filter((g) => g.id !== id) }));

  const upsertRsvp = (rsvp: Rsvp) =>
    mutate((prev) => {
      const idx = prev.rsvps.findIndex((r) => r.invitationId === rsvp.invitationId);
      if (idx >= 0) {
        const rsvps = [...prev.rsvps];
        rsvps[idx] = rsvp;
        return { ...prev, rsvps };
      }
      return { ...prev, rsvps: [...prev.rsvps, rsvp] };
    });

  const mergeRsvps = (list: Rsvp[]): number => {
    mutate((prev) => {
      const rsvps = [...prev.rsvps];
      for (const r of list) {
        const idx = rsvps.findIndex((x) => x.invitationId === r.invitationId);
        if (idx >= 0) {
          rsvps[idx] = { ...rsvps[idx], ...r, updatedAt: Date.now() };
        } else {
          rsvps.push(r);
        }
      }
      return { ...prev, rsvps };
    });
    return list.length;
  };

  const addTable = (t: TableEntity) =>
    mutate((prev) => ({ ...prev, tables: [...prev.tables, t] }));

  const updateTable = (t: TableEntity) =>
    mutate((prev) => ({
      ...prev,
      tables: prev.tables.map((x) => (x.id === t.id ? t : x)),
    }));

  const deleteTable = (id: string) =>
    mutate((prev) => ({
      ...prev,
      tables: prev.tables.filter((t) => t.id !== id),
      guests: prev.guests.map((g) =>
        g.tableId === id ? { ...g, tableId: null, seatNumber: null } : g
      ),
    }));

  const addBeverage = (b: Beverage) =>
    mutate((prev) => ({ ...prev, beverages: [...prev.beverages, b] }));

  const updateBeverage = (b: Beverage) =>
    mutate((prev) => ({
      ...prev,
      beverages: prev.beverages.map((x) => (x.id === b.id ? b : x)),
    }));

  const deleteBeverage = (id: string) =>
    mutate((prev) => ({
      ...prev,
      beverages: prev.beverages.filter((b) => b.id !== id),
      guests: prev.guests.map((g) =>
        g.beverageId === id ? { ...g, beverageId: null, beverageQuantity: null } : g
      ),
    }));

  const replaceAll = (data: WeddingData) =>
    mutate(() => dataToState(data, true));

  const mergeAll = (data: WeddingData) =>
    mutate((prev) => {
      const byId = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
        const map = new Map(existing.map((x) => [x.id, x]));
        for (const item of incoming) map.set(item.id, item);
        return Array.from(map.values());
      };
      return {
        ...prev,
        settings: data.settings ?? prev.settings,
        invitations: byId(prev.invitations, data.invitations ?? []),
        guests: byId(prev.guests, data.guests ?? []),
        rsvps: byId(prev.rsvps, data.rsvps ?? []),
        tables: byId(prev.tables, data.tables ?? []),
        beverages: byId(prev.beverages, data.beverages ?? []),
      };
    });

  const buildWeddingData = (): WeddingData => stateToData(state);

  const resetToPublished = async () => {
    try {
      const res = await fetch(LOAD_URL, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        setState(dataToState(data, false));
        return;
      }
      const fallback = await fetch(DATA_URL, { cache: 'no-cache' });
      const published = await fallback.json();
      setState(dataToState(published, false));
    } catch {
      setState((prev) => ({ ...prev, isDirty: false }));
    }
  };

  const value: StoreValue = {
    ...state,
    updateSettings,
    addInvitation,
    updateInvitation,
    deleteInvitation,
    addGuest,
    updateGuest,
    deleteGuest,
    upsertRsvp,
    mergeRsvps,
    addTable,
    updateTable,
    deleteTable,
    addBeverage,
    updateBeverage,
    deleteBeverage,
    replaceAll,
    mergeAll,
    buildWeddingData,
    resetToPublished,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
