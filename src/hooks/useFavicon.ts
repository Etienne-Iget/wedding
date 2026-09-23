import { useEffect } from 'react';
import type { WeddingSettings } from '@/types';

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90' fill='%23b8860b'%3E%E2%9D%A4%3C/text%3E%3C/svg%3E";

async function imageToDataUrl(src: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      const scale = Math.min(img.width, img.height);
      const sx = (img.width - scale) / 2;
      const sy = (img.height - scale) / 2;
      ctx.drawImage(img, sx, sy, scale, scale, 0, 0, size, size);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

export function useFavicon(settings: WeddingSettings | null) {
  useEffect(() => {
    const logoSrc = settings?.logoSrc;
    const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
    const appleIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement | null;

    if (!logoSrc) {
      if (favicon) favicon.href = DEFAULT_FAVICON;
      if (appleIcon) appleIcon.href = DEFAULT_FAVICON;
      updateManifestIcons([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const icon192 = await imageToDataUrl(logoSrc, 192);
        const icon512 = await imageToDataUrl(logoSrc, 512);
        if (cancelled) return;
        if (favicon) favicon.href = icon192;
        if (appleIcon) appleIcon.href = icon192;
        updateManifestIcons([
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]);
      } catch {
        if (!cancelled) {
          if (favicon) favicon.href = logoSrc;
          if (appleIcon) appleIcon.href = logoSrc;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [settings?.logoSrc]);
}

function updateManifestIcons(icons: { src: string; sizes: string; type: string; purpose: string }[]) {
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  const manifest = {
    name: 'Mariage — Gestion des invités',
    short_name: 'Mariage',
    description: "Gestion d'invités de mariage — 100% locale et hors ligne",
    theme_color: '#1c1915',
    background_color: '#fdfaf3',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    scope: '/',
    lang: 'fr',
    icons,
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = url;
}
