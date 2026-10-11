import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  APPLICATION_NAME,
  type WeddingData,
  type WeddingSettings,
  type Invitation,
  type Guest,
  type Rsvp,
  type TableEntity,
  type Beverage,
} from '@/types';

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
  logoSrc: z.string().nullable().default(null),
  heroPhotoSrc: z.string().nullable().default(null),
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
  checkedInAt: z.number().optional().nullable(),
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

const weddingDataSchema = z.object({
  version: z.number().int().min(1),
  weddingId: z.string().min(1),
  exportedAt: z.string().min(1),
  settings: weddingSettingsSchema.nullable().optional(),
  invitations: z.array(invitationSchema).default([]),
  guests: z.array(guestSchema).default([]),
  rsvps: z.array(rsvpSchema).default([]),
  tables: z.array(tableSchema).default([]),
  beverages: z.array(beverageSchema).default([]),
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

export function summarizeBackup(data: WeddingData): RestoreSummary {
  return {
    invitations: data.invitations?.length ?? 0,
    guests: data.guests?.length ?? 0,
    tables: data.tables?.length ?? 0,
    beverages: data.beverages?.length ?? 0,
    rsvps: data.rsvps?.length ?? 0,
    hasSettings: !!data.settings,
    weddingId: data.weddingId,
    version: data.version,
  };
}

export function parseBackupFile(json: string): WeddingData {
  const parsed = JSON.parse(json);
  const result = weddingDataSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Format de fichier invalide: ${errors}`);
  }
  return result.data as unknown as WeddingData;
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

export type RestoreMode = 'replace' | 'merge';

export type {
  WeddingData,
  WeddingSettings,
  Invitation,
  Guest,
  Rsvp,
  TableEntity,
  Beverage,
};
