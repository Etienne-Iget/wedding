import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  APPLICATION_NAME,
  type BackupFile,
  type WeddingSettings,
} from '@/types';
import { db, SETTINGS_ID, METADATA_ID } from '@/db/database';
import { uuid } from './id';

const eventSchema = z.object({
  date: z.string().default(''),
  time: z.string().default(''),
  venueName: z.string().default(''),
  venueAddress: z.string().default(''),
});

export const weddingSettingsSchema = z.object({
  id: z.string(),
  weddingId: z.string().min(1),
  applicationName: z.string().min(1),
  brideName: z.string().min(1),
  groomName: z.string().min(1),
  weddingDate: z.string().min(1),
  venueName: z.string().min(1),
  venueAddress: z.string().default(''),
  maxGuests: z.number().int().min(1).max(10000),
  contactEmail: z.string().default(''),
  currency: z.string().default('EUR'),
  primaryColor: z.string().default('#b8860b'),
  logoDataUrl: z.string().nullable().default(null),
  heroPhotoDataUrl: z.string().nullable().default(null),
  events: z.object({
    dot: eventSchema,
    civil: eventSchema,
    religious: eventSchema,
  }).default({
    dot: { date: '', time: '', venueName: '', venueAddress: '' },
    civil: { date: '', time: '', venueName: '', venueAddress: '' },
    religious: { date: '', time: '', venueName: '', venueAddress: '' },
  }),
  updatedAt: z.number(),
});

export const invitationSchema = z.object({
  id: z.string(),
  invitationNumber: z.string().min(1),
  familyName: z.string().min(1),
  maxPeople: z.number().int().min(1).max(50),
  qrToken: z.string().min(1),
  contactPhone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const guestSchema = z.object({
  id: z.string(),
  invitationId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  tableId: z.string().optional().nullable(),
  seatNumber: z.number().optional().nullable(),
  beverageId: z.string().optional().nullable(),
  beverageQuantity: z.number().optional().default(1),
  isChild: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const rsvpSchema = z.object({
  id: z.string(),
  invitationId: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'declined']),
  attendingCount: z.number().int().min(0),
  submittedAt: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
  updatedAt: z.number(),
});

export const tableSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  capacity: z.number().int().min(1).max(50),
  shape: z.enum(['round', 'rect', 'square']).default('round'),
  x: z.number().default(100),
  y: z.number().default(100),
  rotation: z.number().default(0),
  color: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const beverageSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z
    .enum(['soft', 'wine', 'beer', 'champagne', 'water', 'juice', 'cocktail', 'other'])
    .default('other'),
  isAlcoholic: z.boolean().default(false),
  stock: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const backupFileSchema = z.object({
  version: z.number().int().min(1),
  application: z.string().min(1),
  weddingId: z.string().min(1),
  exportedAt: z.string().min(1),
  data: z.object({
    settings: weddingSettingsSchema.nullable().optional(),
    invitations: z.array(invitationSchema).default([]),
    guests: z.array(guestSchema).default([]),
    rsvps: z.array(rsvpSchema).default([]),
    tables: z.array(tableSchema).default([]),
    beverages: z.array(beverageSchema).default([]),
    metadata: z.any().nullable().optional(),
  }),
});

export type RestoreSummary = {
  invitations: number;
  guests: number;
  tables: number;
  beverages: number;
  rsvps: number;
  hasSettings: boolean;
  weddingId: string;
  version: number;
};

export function summarizeBackup(file: BackupFile): RestoreSummary {
  return {
    invitations: file.data.invitations.length,
    guests: file.data.guests.length,
    tables: file.data.tables.length,
    beverages: file.data.beverages.length,
    rsvps: file.data.rsvps.length,
    hasSettings: !!file.data.settings,
    weddingId: file.weddingId,
    version: file.version,
  };
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, invitations, guests, rsvps, tables, beverages, metadata] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.invitations.toArray(),
    db.guests.toArray(),
    db.rsvps.toArray(),
    db.weddingTables.toArray(),
    db.beverages.toArray(),
    db.metadata.get(METADATA_ID),
  ]);

  const now = new Date().toISOString();

  // Update metadata last backup timestamp
  if (metadata) {
    await db.metadata.put({ ...metadata, lastBackupAt: Date.now() });
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    application: APPLICATION_NAME,
    weddingId: settings?.weddingId ?? 'etienne-hannah-2026',
    exportedAt: now,
    data: {
      settings: settings ?? null,
      invitations,
      guests,
      rsvps,
      tables,
      beverages,
      metadata: metadata ?? null,
    },
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export async function buildBackupFilename(settings: WeddingSettings | undefined): Promise<string> {
  const weddingId = settings?.weddingId ?? 'etienne-hannah-2026';
  return `${weddingId}.json`;
}

export type RestoreMode = 'replace' | 'merge';

export async function restoreBackup(
  file: BackupFile,
  mode: RestoreMode
): Promise<void> {
  const data = file.data;

  await db.transaction(
    'rw',
    [db.settings, db.invitations, db.guests, db.rsvps, db.weddingTables, db.beverages, db.metadata],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.invitations.clear(),
          db.guests.clear(),
          db.rsvps.clear(),
          db.weddingTables.clear(),
          db.beverages.clear(),
        ]);
      }

      if (data.settings) {
        await db.settings.put(data.settings);
      }

      if (data.invitations.length) {
        if (mode === 'merge') {
          await db.invitations.bulkPut(data.invitations);
        } else {
          await db.invitations.bulkAdd(data.invitations);
        }
      }
      if (data.guests.length) await db.guests.bulkPut(data.guests);
      if (data.rsvps.length) await db.rsvps.bulkPut(data.rsvps);
      if (data.tables.length) await db.weddingTables.bulkPut(data.tables);
      if (data.beverages.length) await db.beverages.bulkPut(data.beverages);

      if (data.metadata) {
        await db.metadata.put(data.metadata);
      } else {
        await db.metadata.put({
          id: METADATA_ID,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          installedAt: Date.now(),
        });
      }
    }
  );
}

export function parseBackupFile(json: string): BackupFile {
  const parsed = JSON.parse(json);
  const result = backupFileSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Format de sauvegarde invalide: ${errors}`);
  }
  return result.data as unknown as BackupFile;
}

// Ensure default settings + metadata exist on first run.
export async function ensureSeedData(): Promise<void> {
  const settings = await db.settings.get(SETTINGS_ID);
  if (!settings) {
    const now = Date.now();
    const defaultSettings: WeddingSettings = {
      id: SETTINGS_ID,
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
      logoDataUrl: null,
      heroPhotoDataUrl: null,
      events: {
        dot: { date: '', time: '', venueName: '', venueAddress: '' },
        civil: { date: '', time: '', venueName: '', venueAddress: '' },
        religious: { date: '', time: '', venueName: '', venueAddress: '' },
      },
      updatedAt: now,
    };
    await db.settings.put(defaultSettings);
  }

  const meta = await db.metadata.get(METADATA_ID);
  if (!meta) {
    await db.metadata.put({
      id: METADATA_ID,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      installedAt: Date.now(),
    });
  }
}

// Merge helper used by RSVP import.
export async function mergeRsvpImport(
  rsvps: import('@/types').Rsvp[]
): Promise<number> {
  let count = 0;
  for (const r of rsvps) {
    const existing = await db.rsvps.get(r.invitationId);
    await db.rsvps.put({
      id: existing?.id ?? r.invitationId,
      invitationId: r.invitationId,
      status: r.status,
      attendingCount: r.attendingCount,
      submittedAt: r.submittedAt ?? Date.now(),
      note: r.note ?? existing?.note ?? undefined,
      updatedAt: Date.now(),
    });
    count++;
  }
  return count;
}
