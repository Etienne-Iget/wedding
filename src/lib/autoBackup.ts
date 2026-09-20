import { db, SETTINGS_ID, METADATA_ID } from '@/db/database';
import type { BackupFile } from '@/types';
import { CURRENT_SCHEMA_VERSION, APPLICATION_NAME } from '@/types';

const STORAGE_KEY = 'wgm:auto-backup';
const STORAGE_TS_KEY = 'wgm:auto-backup-ts';

function buildBackupObject(): Promise<BackupFile> {
  return (async () => {
    const [settings, invitations, guests, rsvps, tables, beverages, metadata] = await Promise.all([
      db.settings.get(SETTINGS_ID),
      db.invitations.toArray(),
      db.guests.toArray(),
      db.rsvps.toArray(),
      db.weddingTables.toArray(),
      db.beverages.toArray(),
      db.metadata.get(METADATA_ID),
    ]);

    return {
      version: CURRENT_SCHEMA_VERSION,
      application: APPLICATION_NAME,
      weddingId: settings?.weddingId ?? 'mariage',
      exportedAt: new Date().toISOString(),
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
  })();
}

export async function saveAutoBackup(): Promise<void> {
  try {
    const backup = await buildBackupObject();
    const json = JSON.stringify(backup);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  } catch (e) {
    // localStorage might be full (images are heavy). Try without images.
    try {
      const backup = await buildBackupObject();
      if (backup.data.settings) {
        backup.data.settings = {
          ...backup.data.settings,
          logoDataUrl: null,
          heroPhotoDataUrl: null,
        };
      }
      const json = JSON.stringify(backup);
      localStorage.setItem(STORAGE_KEY, json);
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    } catch {
      console.warn('Auto-backup: impossible de sauvegarder dans localStorage');
    }
  }
}

export function getAutoBackupAge(): number | null {
  const ts = localStorage.getItem(STORAGE_TS_KEY);
  if (!ts) return null;
  return Date.now() - Number(ts);
}

export function hasAutoBackup(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export async function restoreAutoBackup(): Promise<boolean> {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return false;

  let backup: BackupFile;
  try {
    backup = JSON.parse(json) as BackupFile;
  } catch {
    return false;
  }

  if (!backup.data) return false;

  const data = backup.data;

  await db.transaction(
    'rw',
    [db.settings, db.invitations, db.guests, db.rsvps, db.weddingTables, db.beverages, db.metadata],
    async () => {
      // Only restore if IndexedDB is currently empty
      const existingInv = await db.invitations.count();
      const existingSettings = await db.settings.get(SETTINGS_ID);
      if (existingInv > 0 || existingSettings) return;

      if (data.settings) {
        await db.settings.put(data.settings);
      }
      if (data.invitations.length) await db.invitations.bulkAdd(data.invitations);
      if (data.guests.length) await db.guests.bulkAdd(data.guests);
      if (data.rsvps.length) await db.rsvps.bulkAdd(data.rsvps);
      if (data.tables.length) await db.weddingTables.bulkAdd(data.tables);
      if (data.beverages.length) await db.beverages.bulkAdd(data.beverages);
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

  return true;
}
