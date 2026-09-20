export type RsvpStatus = 'pending' | 'confirmed' | 'declined';

export interface WeddingEvent {
  date: string;
  time: string;
  venueName: string;
  venueAddress: string;
}

export interface WeddingSettings {
  id: string;
  weddingId: string;
  applicationName: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  venueName: string;
  venueAddress: string;
  maxGuests: number;
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
  id: string;
  invitationNumber: string;
  familyName: string;
  maxPeople: number;
  qrToken: string;
  contactPhone?: string;
  email?: string;
  notes?: string;
  checkedInAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Guest {
  id: string;
  invitationId: string;
  firstName: string;
  lastName: string;
  tableId?: string | null;
  seatNumber?: number | null;
  beverageId?: string | null;
  beverageQuantity?: number | null;
  isChild: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Rsvp {
  id: string;
  invitationId: string;
  status: RsvpStatus;
  attendingCount: number;
  submittedAt: number | null;
  note?: string | null;
  updatedAt: number;
}

export interface TableEntity {
  id: string;
  name: string;
  capacity: number;
  shape: 'round' | 'rect' | 'square';
  x: number;
  y: number;
  rotation?: number;
  color?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Beverage {
  id: string;
  name: string;
  category: 'soft' | 'wine' | 'beer' | 'champagne' | 'water' | 'juice' | 'cocktail' | 'other';
  isAlcoholic: boolean;
  stock?: number | null;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeddingData {
  version: number;
  weddingId: string;
  exportedAt: string;
  settings: WeddingSettings;
  invitations: Invitation[];
  guests: Guest[];
  rsvps: Rsvp[];
  tables: TableEntity[];
  beverages: Beverage[];
}

export const CURRENT_SCHEMA_VERSION = 1;
export const APPLICATION_NAME = 'Wedding Guest Manager';
