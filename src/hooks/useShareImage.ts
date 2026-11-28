import { useEffect } from 'react';
import type { WeddingSettings } from '@/types';

function setMetaAttr(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) el.setAttribute(attr, value);
}

export function useShareImage(settings: WeddingSettings | null) {
  useEffect(() => {
    if (!settings) return;

    const absolutePosterUrl = `${window.location.origin}/poster-share.webp`;
    setMetaAttr('meta[property="og:image"]', 'content', absolutePosterUrl);
    setMetaAttr('meta[name="twitter:image"]', 'content', absolutePosterUrl);
    setMetaAttr('meta[property="og:title"]', 'content', `${settings.brideName} & ${settings.groomName} — Invitation`);
    setMetaAttr('meta[property="og:description"]', 'content', 'Découvrez notre invitation et confirmez votre présence.');
    setMetaAttr('meta[name="twitter:title"]', 'content', `${settings.brideName} & ${settings.groomName} — Invitation`);
    setMetaAttr('meta[name="twitter:description"]', 'content', 'Découvrez notre invitation et confirmez votre présence.');
  }, [settings]);
}
