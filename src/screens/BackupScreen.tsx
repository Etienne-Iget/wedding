import { useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Save,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  CloudOff,
  ShieldCheck,
  CloudUpload,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/StoreContext';
import { useSettings, useInvitations, useGuests, useTables, useBeverages, useRsvps } from '@/hooks/useLiveData';
import {
  downloadJson,
  parseBackupFile,
  summarizeBackup,
  type RestoreSummary,
  type RestoreMode,
  type WeddingData,
} from '@/lib/backup';
import {
  exportGuestsCsv,
  exportBeveragesCsv,
  exportTablesCsv,
} from '@/lib/csv';
import {
  generateGuestListPdf,
  generateSeatingPdf,
  generateBeveragePdf,
  generateQrInvitationsPdf,
} from '@/lib/pdf';

export function BackupScreen() {
  const settings = useSettings();
  const invitations = useInvitations();
  const guests = useGuests();
  const tables = useTables();
  const beverages = useBeverages();
  const rsvps = useRsvps();
  const { show } = useToast();
  const { buildWeddingData, replaceAll, mergeAll, isDirty, resetToPublished } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ data: WeddingData; summary: RestoreSummary } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace');

  const pdfData = { settings: settings ?? null, invitations, guests, rsvps, tables, beverages };

  const doExport = () => {
    setBusy(true);
    try {
      const data = buildWeddingData();
      const filename = `${settings?.weddingId ?? 'mariage'}.json`;
      downloadJson(filename, data);
      show('success', 'Sauvegarde téléchargée avec succès.');
    } catch {
      show('error', "Erreur lors de l'export.");
    } finally {
      setBusy(false);
    }
  };

  const doPublish = () => {
    setBusy(true);
    try {
      const data = buildWeddingData();
      const filename = 'wedding-data.json';
      downloadJson(filename, data);
      show('success', 'Fichier de publication téléchargé. Placez-le dans le dossier public/data/ et redéployez le site.');
    } catch {
      show('error', 'Erreur lors de la génération du fichier de publication.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseBackupFile(text);
      const summary = summarizeBackup(parsed);
      setPending({ data: parsed, summary });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Fichier illisible.';
      show('error', msg);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (restoreMode === 'replace') {
        replaceAll(pending.data);
      } else {
        mergeAll(pending.data);
      }
      show('success', `Données restaurées (${pending.summary.invitations} invitations, ${pending.summary.guests} invités).`);
      setPending(null);
    } catch {
      show('error', 'Erreur lors de la restauration.');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    await resetToPublished();
    show('info', 'Modifications non publiées annulées. Les données publiées ont été rechargées.');
  };

  const csvActions = [
    { label: 'Invités', desc: 'invitation, famille, table, place, RSVP, boisson', fn: () => exportGuestsCsv(pdfData) },
    { label: 'Boissons', desc: 'invité, table, place, boisson, quantité', fn: () => exportBeveragesCsv(pdfData) },
    { label: 'Tables', desc: 'table, capacité, occupé, disponible', fn: () => exportTablesCsv(pdfData) },
  ];

  const pdfActions = [
    { label: 'Liste des invités', desc: 'Liste complète triée par famille', fn: () => generateGuestListPdf(pdfData), icon: FileText },
    { label: 'Plan de tables', desc: 'Répartition par table et place', fn: () => generateSeatingPdf(pdfData), icon: FileText },
    { label: 'Plan boissons', desc: 'Récapitulatif et détail par invité', fn: () => generateBeveragePdf(pdfData), icon: FileText },
    { label: 'QR codes', desc: 'Cartes d\'invitation avec QR code', fn: () => generateQrInvitationsPdf(pdfData), icon: FileText },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Sauvegarde & Publication"
        subtitle="Publiez vos données pour qu'elles soient visibles par tous les visiteurs"
        icon={<DatabaseBackup size={22} />}
      />

      {/* Publish banner */}
      <div className="card p-5 border-gold-300 bg-gold-50/50">
        <div className="flex items-start gap-3">
          <CloudUpload size={22} className="text-gold-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink-800">Publier les données du mariage</h3>
            <p className="text-sm text-ink-600 mt-1">
              Téléchargez le fichier <span className="font-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded">wedding-data.json</span>,
              puis placez-le dans le dossier <span className="font-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded">public/data/</span> de votre projet
              et redéployez le site. Tous les visiteurs verront alors les mêmes données.
            </p>
            {isDirty && (
              <p className="text-xs text-amber-700 mt-2 bg-amber-100 rounded-lg px-3 py-2">
                Vous avez des modifications non publiées. Elles sont sauvegardées sur cet appareil mais ne sont pas encore visibles par les autres visiteurs.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={doPublish} disabled={busy} className="btn-primary">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                Télécharger le fichier de publication
              </button>
              {isDirty && (
                <button onClick={doReset} disabled={busy} className="btn-secondary">
                  <RotateCcw size={18} /> Annuler les modifications non publiées
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current data summary */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Données actuellement dans l'application</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <DataPill label="Invitations" value={invitations.length} />
          <DataPill label="Invités" value={guests.length} />
          <DataPill label="Tables" value={tables.length} />
          <DataPill label="Boissons" value={beverages.length} />
          <DataPill label="RSVP" value={rsvps.filter((r) => r.status !== 'pending').length} />
        </div>
      </div>

      {/* JSON backup */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Save size={18} className="text-gold-500" />
          <h3 className="text-base font-semibold text-ink-800">Sauvegarde complète (JSON)</h3>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Le fichier JSON contient toutes les données du mariage et permet une restauration complète.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={doExport} disabled={busy} className="btn-primary">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Télécharger une sauvegarde
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={18} /> Restaurer une sauvegarde
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        </div>
      </div>

      {/* CSV exports */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet size={18} className="text-blue-500" />
          <h3 className="text-base font-semibold text-ink-800">Export CSV</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {csvActions.map((a) => (
            <button key={a.label} onClick={a.fn} className="card-hover p-4 text-left">
              <p className="font-medium text-ink-800">{a.label}</p>
              <p className="text-xs text-ink-400 mt-1">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* PDF exports */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-red-500" />
          <h3 className="text-base font-semibold text-ink-800">Génération PDF</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pdfActions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => void a.fn()} className="card-hover p-4 text-left">
                <Icon size={18} className="text-red-400 mb-2" />
                <p className="font-medium text-ink-800">{a.label}</p>
                <p className="text-xs text-ink-400 mt-1">{a.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Offline info */}
      <div className="card p-5 bg-ink-50/50">
        <div className="flex items-start gap-3">
          <CloudOff size={20} className="text-ink-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-ink-700">Fonctionnement hors ligne</h3>
            <p className="text-sm text-ink-500 mt-1">
              Cette application est une PWA. Une fois installée, elle fonctionne sans connexion Internet.
              Les données publiées sont incluses dans le site et visibles par tous les visiteurs.
            </p>
          </div>
        </div>
      </div>

      {/* Restore confirmation modal */}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restaurer la sauvegarde"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPending(null)}>Annuler</button>
            <button className="btn-danger" onClick={confirmRestore} disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Restaurer
            </button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gold-50 border border-gold-200 p-4">
              <p className="text-xs text-gold-700 font-mono">Version {pending.summary.version} · {pending.summary.weddingId}</p>
              <h4 className="font-medium text-ink-800 mt-1">Cette sauvegarde contient :</h4>
              <ul className="mt-2 space-y-1 text-sm text-ink-600">
                <li>{pending.summary.invitations} invitations</li>
                <li>{pending.summary.guests} invités enregistrés</li>
                <li>{pending.summary.tables} tables</li>
                <li>{pending.summary.beverages} boissons</li>
                <li>{pending.summary.rsvps} réponses RSVP</li>
              </ul>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex gap-2">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                La restauration <strong>remplacera</strong> les données actuellement présentes dans cette application.
              </p>
            </div>

            <div>
              <label className="label">Mode de restauration</label>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${restoreMode === 'replace' ? 'border-gold-400 bg-gold-50' : 'border-ink-200 hover:border-gold-300'}`}>
                  <input type="radio" name="mode" className="mt-0.5" checked={restoreMode === 'replace'} onChange={() => setRestoreMode('replace')} />
                  <div>
                    <p className="text-sm font-medium text-ink-800">Remplacer (recommandé)</p>
                    <p className="text-xs text-ink-400">Efface toutes les données actuelles et restaure la sauvegarde.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${restoreMode === 'merge' ? 'border-gold-400 bg-gold-50' : 'border-ink-200 hover:border-gold-300'}`}>
                  <input type="radio" name="mode" className="mt-0.5" checked={restoreMode === 'merge'} onChange={() => setRestoreMode('merge')} />
                  <div>
                    <p className="text-sm font-medium text-ink-800">Fusionner</p>
                    <p className="text-xs text-ink-400">Ajoute ou met à jour les enregistrements de la sauvegarde sans effacer les autres.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DataPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2 text-center">
      <p className="text-xl font-display font-semibold text-ink-800">{value}</p>
      <p className="text-xs text-ink-400">{label}</p>
    </div>
  );
}
