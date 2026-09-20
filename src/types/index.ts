// Core domain types for the wedding guest manager.
// All data lives in IndexedDB on the admin's device — nothing is sent to a server.

export type RsvpStatus = 'pending' | 'confirmed' | 'declined';

export interface WeddingEvent {
  date: string;
  time: string;
  venueName: string;
  venueAddress: string;
}

export interface WeddingSettings {
  id: string; // always 'current'
  weddingId: string; // e.g. 'etienne-hannah-2026'
  applicationName: string;
  brideName: string;
  groomName: string;
  weddingDate: string; // ISO date
  venueName: string;
  venueAddress: string;
  maxGuests: number; // overall cap (e.g. 100)
  contactEmail: string;
  currency: string;
  primaryColor: string;
  logoDataUrl: string | null;
  heroPhotoDataUrl: string | null;
  events: {
    dot: WeddingEvent;
    civil: WeddingEvent;
    religious: WeddingEvent;
  };
  updatedAt: number;
}

export interface Invitation {
  id: string; // uuid
  invitationNumber: string; // INV-001
  familyName: string;
  maxPeople: number; // people allowed on this invitation
  qrToken: string; // unique token encoded in QR code
  contactPhone?: string;
  email?: string;
  notes?: string;
  checkedInAt?: number | null; // timestamp when guest arrived (scanned at door)
  createdAt: number;
  updatedAt: number;
}

export interface Guest {
  id: string; // uuid
  invitationId: string; // parent invitation
  firstName: string;
  lastName: string;
  tableId?: string | null;
  seatNumber?: number | null;
  beverageId?: string | null; // chosen beverage
  beverageQuantity?: number | null;
  isChild: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Rsvp {
  id: string; // equals invitationId for 1:1 mapping
  invitationId: string;
  status: RsvpStatus;
  attendingCount: number; // number of people attending
  submittedAt: number | null;
  note?: string | null;
  updatedAt: number;
}

export interface TableEntity {
  id: string; // uuid
  name: string; // "Table 1"
  capacity: number;
  shape: 'round' | 'rect' | 'square';
  x: number; // position on floor plan (px)
  y: number;
  rotation?: number;
  color?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Beverage {
  id: string; // uuid
  name: string;
  category: 'soft' | 'wine' | 'beer' | 'champagne' | 'water' | 'juice' | 'cocktail' | 'other';
  isAlcoholic: boolean;
  stock?: number | null;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppMetadata {
  id: string; // always 'current'
  schemaVersion: number;
  lastBackupAt?: number;
  installedAt: number;
}

// Shape of the full JSON backup file.
export interface BackupFile {
  version: number;
  application: string;
  weddingId: string;
  exportedAt: string;
  data: {
    settings: WeddingSettings | null;
    invitations: Invitation[];
    guests: Guest[];
    rsvps: Rsvp[];
    tables: TableEntity[];
    beverages: Beverage[];
    metadata: AppMetadata | null;
  };
}

export const CURRENT_SCHEMA_VERSION = 1;
export const APPLICATION_NAME = 'Wedding Guest Manager';
