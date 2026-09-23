import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Settings as SettingsIcon, Save, Trash2, Image as ImageIcon, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useSettings } from '@/hooks/useLiveData';
import { useStore } from '@/store/StoreContext';
import type { WeddingSettings, WeddingEvent } from '@/types';

interface FormValues {
  brideName: string;
  groomName: string;
  weddingDate: string;
  venueName: string;
  venueAddress: string;
  maxGuests: number;
  contactEmail: string;
  currency: string;
  weddingId: string;
  primaryColor: string;
  logoSrc: string;
  heroPhotoSrc: string;
  dotDate: string;
  dotTime: string;
  dotVenueName: string;
  dotVenueAddress: string;
  civilDate: string;
  civilTime: string;
  civilVenueName: string;
  civilVenueAddress: string;
  religiousDate: string;
  religiousTime: string;
  religiousVenueName: string;
  religiousVenueAddress: string;
}

const emptyEvent: WeddingEvent = { date: '', time: '', venueName: '', venueAddress: '' };

export function SettingsScreen() {
  const settings = useSettings();
  const { show } = useToast();
  const { updateSettings } = useStore();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>();

  const [logoSrc, setLogoSrc] = useState<string>('');
  const [heroPhotoSrc, setHeroPhotoSrc] = useState<string>('');

  useEffect(() => {
    if (settings) {
      const ev = settings.events ?? { dot: emptyEvent, civil: emptyEvent, religious: emptyEvent };
      reset({
        brideName: settings.brideName,
        groomName: settings.groomName,
        weddingDate: settings.weddingDate,
        venueName: settings.venueName,
        venueAddress: settings.venueAddress,
        maxGuests: settings.maxGuests,
        contactEmail: settings.contactEmail,
        currency: settings.currency,
        weddingId: settings.weddingId,
        primaryColor: settings.primaryColor,
        logoSrc: settings.logoSrc ?? '',
        heroPhotoSrc: settings.heroPhotoSrc ?? '',
        dotDate: ev.dot.date,
        dotTime: ev.dot.time,
        dotVenueName: ev.dot.venueName,
        dotVenueAddress: ev.dot.venueAddress,
        civilDate: ev.civil.date,
        civilTime: ev.civil.time,
        civilVenueName: ev.civil.venueName,
        civilVenueAddress: ev.civil.venueAddress,
        religiousDate: ev.religious.date,
        religiousTime: ev.religious.time,
        religiousVenueName: ev.religious.venueName,
        religiousVenueAddress: ev.religious.venueAddress,
      });
      setLogoSrc(settings.logoSrc ?? '');
      setHeroPhotoSrc(settings.heroPhotoSrc ?? '');
    }
  }, [settings, reset]);

  const onSubmit = async (values: FormValues) => {
    const now = Date.now();
    const updated: WeddingSettings = {
      id: 'current',
      applicationName: settings?.applicationName ?? 'Wedding Guest Manager',
      weddingId: values.weddingId,
      brideName: values.brideName,
      groomName: values.groomName,
      weddingDate: values.weddingDate,
      venueName: values.venueName,
      venueAddress: values.venueAddress,
      maxGuests: values.maxGuests,
      contactEmail: values.contactEmail,
      currency: values.currency,
      primaryColor: values.primaryColor,
      logoSrc: logoSrc || null,
      heroPhotoSrc: heroPhotoSrc || null,
      events: {
        dot: { date: values.dotDate, time: values.dotTime, venueName: values.dotVenueName, venueAddress: values.dotVenueAddress },
        civil: { date: values.civilDate, time: values.civilTime, venueName: values.civilVenueName, venueAddress: values.civilVenueAddress },
        religious: { date: values.religiousDate, time: values.religiousTime, venueName: values.religiousVenueName, venueAddress: values.religiousVenueAddress },
      },
      updatedAt: now,
    };
    updateSettings(updated);
    show('success', 'Paramètres du mariage enregistrés. Pensez à publier les modifications via la page Sauvegarde.');
  };

  if (!settings) {
    return <div className="p-8 text-ink-400">Chargement des paramètres…</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Paramètres du mariage"
        subtitle="Informations principales et configuration du projet"
        icon={<SettingsIcon size={22} />}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6">
        <Section title="Le couple" subtitle="Noms affichés dans l'application et sur les documents">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom de la mariée" error={errors.brideName?.message}>
              <input className="input" {...register('brideName', { required: 'Champ requis' })} />
            </Field>
            <Field label="Prénom du marié" error={errors.groomName?.message}>
              <input className="input" {...register('groomName', { required: 'Champ requis' })} />
            </Field>
          </div>
        </Section>

        <Section title="Logo & Photo principale" subtitle="Chemins des images placées dans le dossier public/images/ du projet">
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Placez vos images dans le dossier <span className="font-mono">public/images/</span> de votre projet,
                puis indiquez le chemin ici. Exemple : <span className="font-mono">/images/logo.png</span>.
                Les images sont déployées avec le site et visibles par tous les visiteurs.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="label">Logo du mariage</label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-cream overflow-hidden">
                    {logoSrc ? (
                      <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon size={24} className="text-ink-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      className="input font-mono text-sm"
                      placeholder="/images/logo.png"
                      value={logoSrc}
                      onChange={(e) => setLogoSrc(e.target.value)}
                    />
                    {logoSrc && (
                      <button
                        type="button"
                        onClick={() => setLogoSrc('')}
                        className="btn-ghost btn-sm text-red-500 hover:text-red-600 self-start"
                      >
                        <Trash2 size={16} /> Retirer
                      </button>
                    )}
                    <p className="text-xs text-ink-400">Chemin depuis public/, ex: /images/logo.png</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Photo principale</label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-cream overflow-hidden">
                    {heroPhotoSrc ? (
                      <img src={heroPhotoSrc} alt="Photo principale" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-ink-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      className="input font-mono text-sm"
                      placeholder="/images/main-photo.jpg"
                      value={heroPhotoSrc}
                      onChange={(e) => setHeroPhotoSrc(e.target.value)}
                    />
                    {heroPhotoSrc && (
                      <button
                        type="button"
                        onClick={() => setHeroPhotoSrc('')}
                        className="btn-ghost btn-sm text-red-500 hover:text-red-600 self-start"
                      >
                        <Trash2 size={16} /> Retirer
                      </button>
                    )}
                    <p className="text-xs text-ink-400">Chemin depuis public/, ex: /images/main-photo.jpg</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Événement principal" subtitle="Date et lieu du mariage">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date du mariage" error={errors.weddingDate?.message}>
              <input type="date" className="input" {...register('weddingDate', { required: 'Champ requis' })} />
            </Field>
            <Field label="Nombre maximum d'invités" error={errors.maxGuests?.message}>
              <input
                type="number"
                min={1}
                max={10000}
                className="input"
                {...register('maxGuests', { required: 'Champ requis', min: 1, valueAsNumber: true })}
              />
            </Field>
            <Field label="Nom du lieu">
              <input className="input" placeholder="Salle, domaine, église…" {...register('venueName')} />
            </Field>
            <Field label="Adresse du lieu">
              <input className="input" {...register('venueAddress')} />
            </Field>
          </div>
        </Section>

        <Section title="La dot" subtitle="Date et lieu de la cérémonie de dot">
          <EventFields register={register} prefix="dot" />
        </Section>

        <Section title="Mariage civil" subtitle="Date et lieu du mariage civil">
          <EventFields register={register} prefix="civil" />
        </Section>

        <Section title="Mariage religieux" subtitle="Date et lieu du mariage religieux">
          <EventFields register={register} prefix="religious" />
        </Section>

        <Section title="Projet" subtitle="Identifiant unique du mariage et préférences">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identifiant du mariage" help="Utilisé pour le nom du fichier de sauvegarde">
              <input className="input font-mono text-sm" {...register('weddingId', { required: 'Champ requis' })} />
            </Field>
            <Field label="Email de contact">
              <input type="email" className="input" {...register('contactEmail')} />
            </Field>
            <Field label="Devise">
              <select className="input" {...register('currency')}>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
                <option value="GBP">Livre (£)</option>
                <option value="CHF">Franc suisse (CHF)</option>
                <option value="CAD">Dollar canadien (C$)</option>
              </select>
            </Field>
            <Field label="Couleur principale" help="Couleur d'accent pour l'application">
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-14 rounded border border-ink-200 cursor-pointer" {...register('primaryColor')} />
                <input className="input" {...register('primaryColor')} />
              </div>
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pt-2 border-t border-ink-100">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            <Save size={18} /> Enregistrer les paramètres
          </button>
        </div>
      </form>

      <div className="card p-5 border-amber-200 bg-amber-50/50">
        <p className="text-sm text-amber-800">
          <strong>Publication :</strong> les modifications sont enregistrées en mémoire et visibles immédiatement dans l'aperçu.
          Pour les rendre visibles par tous les visiteurs, exportez le fichier de publication depuis la page « Sauvegarde »,
          puis placez-le dans <span className="font-mono text-xs">public/data/</span> et redéployez le site.
          Les images doivent être placées dans <span className="font-mono text-xs">public/images/</span> et commitées dans le dépôt.
        </p>
      </div>
    </div>
  );
}

function EventFields({ register, prefix }: { register: ReturnType<typeof useForm<FormValues>>['register']; prefix: 'dot' | 'civil' | 'religious' }) {
  const labels = {
    dot: { date: 'Date de la dot', venue: 'Lieu de la dot' },
    civil: { date: 'Date du mariage civil', venue: 'Lieu du mariage civil' },
    religious: { date: 'Date du mariage religieux', venue: 'Lieu du mariage religieux' },
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={labels[prefix].date}>
        <input type="date" className="input" {...register(`${prefix}Date`)} />
      </Field>
      <Field label="Heure">
        <input type="time" step="60" className="input" {...register(`${prefix}Time`)} />
      </Field>
      <Field label={labels[prefix].venue}>
        <input className="input" placeholder="Nom du lieu" {...register(`${prefix}VenueName`)} />
      </Field>
      <Field label="Adresse">
        <input className="input" {...register(`${prefix}VenueAddress`)} />
      </Field>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {subtitle && <p className="text-sm text-ink-400 mb-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function Field({ label, error, help, children }: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {help && <p className="help-text">{help}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
