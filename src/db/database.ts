import Dexie, { type Table as DexieTable } from 'dexie';
import type {
  WeddingSettings,
  Invitation,
  Guest,
  Rsvp,
  TableEntity,
  Beverage,
  AppMetadata,
} from '@/types';

export class WeddingDB extends Dexie {
  settings!: DexieTable<WeddingSettings, string>;
  invitations!: DexieTable<Invitation, string>;
  guests!: DexieTable<Guest, string>;
  rsvps!: DexieTable<Rsvp, string>;
  weddingTables!: DexieTable<TableEntity, string>;
  beverages!: DexieTable<Beverage, string>;
  metadata!: DexieTable<AppMetadata, string>;

  constructor() {
    super('wedding-guest-manager');
    this.version(1).stores({
      settings: 'id',
      invitations: 'id, invitationNumber, familyName, qrToken, checkedInAt',
      guests: 'id, invitationId, tableId, beverageId, lastName, firstName',
      rsvps: 'id, invitationId, status',
      weddingTables: 'id, name',
      beverages: 'id, name, category',
      metadata: 'id',
    });
  }
}

export const db = new WeddingDB();

export const SETTINGS_ID = 'current';
export const METADATA_ID = 'current';
