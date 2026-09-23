import { useEffect, useRef } from 'react';
import type { WeddingSettings } from '@/types';
import { generatePoster } from '@/lib/poster';

function setMetaAttr(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) el.setAttribute(attr, value);
}

export function useShareImage(settings: WeddingSettings | null) {
  const lastKey = useRef('');

  useEffect(() => {
    if (!settings) return;

    const key = `${settings.brideName}|${settings.groomName}|${settings.weddingDate}|${settings.heroPhotoSrc ?? ''}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const absolutePosterUrl = `${window.location.origin}/poster.webp`;
    setMetaAttr('meta[property="og:image"]', 'content', absolutePosterUrl);
    setMetaAttr('meta[name="twitter:image"]', 'content', absolutePosterUrl);

    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await generatePoster(settings, { format: 'square' });
        if (cancelled) return;
        setMetaAttr('meta[property="og:image"]', 'content', dataUrl);
        setMetaAttr('meta[name="twitter:image"]', 'content', dataUrl);
      } catch {
        // keep static poster URL as fallback
      }
    })();

    return () => { cancelled = true; };
  }, [settings]);
}
