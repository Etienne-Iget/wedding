import { useEffect, useState } from 'react';
import { Sidebar, type RouteId } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';
import { StoreProvider, useStore } from '@/store/StoreContext';
import { Dashboard } from '@/screens/Dashboard';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { InvitationsScreen } from '@/screens/InvitationsScreen';
import { GuestsScreen } from '@/screens/GuestsScreen';
import { RsvpScreen } from '@/screens/RsvpScreen';
import { ArrivalsScreen } from '@/screens/ArrivalsScreen';
import { TablesScreen } from '@/screens/TablesScreen';
import { BeveragesScreen } from '@/screens/BeveragesScreen';
import { FloorPlanScreen } from '@/screens/FloorPlanScreen';
import { BackupScreen } from '@/screens/BackupScreen';
import { ClientPreview } from '@/screens/ClientPreview';
import { useSettings } from '@/hooks/useLiveData';
import { useFavicon } from '@/hooks/useFavicon';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function AppContent() {
  const [route, setRoute] = useState<RouteId>('dashboard');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [showAdminPreview, setShowAdminPreview] = useState(false);
  const settings = useSettings();
  const { loaded } = useStore();
  useFavicon(settings);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invite');
    if (inv) {
      setInviteToken(inv);
    }
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gold-300 border-t-gold-600" />
          <p className="mt-3 text-sm text-ink-400">Chargement de votre mariage…</p>
        </div>
      </div>
    );
  }

  if (inviteToken) {
    return (
      <ClientPreview
        inviteToken={inviteToken}
        onClose={() => {
          setInviteToken(null);
          if (window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  if (showAdminPreview) {
    return (
      <ClientPreview
        onClose={() => setShowAdminPreview(false)}
      />
    );
  }

  const coupleNames = settings ? `${settings.brideName} & ${settings.groomName}` : 'Notre mariage';
  const weddingDate = settings ? formatDate(settings.weddingDate) : '';

  const render = () => {
    switch (route) {
      case 'dashboard': return <Dashboard onNavigate={setRoute} onPreview={() => setShowAdminPreview(true)} />;
      case 'settings': return <SettingsScreen />;
      case 'invitations': return <InvitationsScreen />;
      case 'guests': return <GuestsScreen />;
      case 'rsvp': return <RsvpScreen />;
      case 'arrivals': return <ArrivalsScreen />;
      case 'tables': return <TablesScreen />;
      case 'beverages': return <BeveragesScreen />;
      case 'floorplan': return <FloorPlanScreen />;
      case 'backup': return <BackupScreen />;
      default: return <Dashboard onNavigate={setRoute} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar current={route} onNavigate={setRoute} coupleNames={coupleNames} weddingDate={weddingDate} logoSrc={settings?.logoSrc} />
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen flex flex-col">
        <div className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in" key={route}>
          {render()}
        </div>
        <footer className="border-t border-ink-100 bg-white/50 py-4 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl flex items-center justify-center">
            <p className="text-xs text-ink-400">
              Design by <span className="font-medium text-ink-600">Igugu Etienne</span>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ToastProvider>
  );
}
