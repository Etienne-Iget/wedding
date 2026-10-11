import type { WeddingSettings } from '@/types';

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateParts(iso: string): { day: string; month: string; year: string } {
  try {
    const d = new Date(iso);
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: d.toLocaleDateString('fr-FR', { month: 'long' }),
      year: String(d.getFullYear()),
    };
  } catch {
    return { day: '', month: '', year: '' };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generates a beautiful save-the-date poster image (1080x1350 Instagram portrait)
 * using the wedding settings. Returns a data URL the user can download or share.
 */
export async function generatePoster(
  settings: WeddingSettings,
  options?: { format?: 'portrait' | 'square' }
): Promise<string> {
  const format = options?.format ?? 'portrait';
  const W = format === 'square' ? 1080 : 1080;
  const H = format === 'square' ? 1080 : 1350;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  // Background gradient (dark ink)
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#1a1a2e');
  bgGrad.addColorStop(0.5, '#16213e');
  bgGrad.addColorStop(1, '#0f0f1e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Try to draw hero photo as background with overlay
  if (settings.heroPhotoSrc) {
    try {
      const img = await loadImage(settings.heroPhotoSrc);
      // Draw image covering the canvas (object-fit: cover)
      const scale = Math.max(W / img.width, H / img.height);
      const sw = W / scale;
      const sh = H / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      // Dark overlay gradient for text readability
      const overlay = ctx.createLinearGradient(0, 0, 0, H);
      overlay.addColorStop(0, 'rgba(15, 15, 30, 0.65)');
      overlay.addColorStop(0.4, 'rgba(15, 15, 30, 0.45)');
      overlay.addColorStop(0.7, 'rgba(15, 15, 30, 0.75)');
      overlay.addColorStop(1, 'rgba(15, 15, 30, 0.92)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, W, H);
    } catch {
      // If image fails, keep gradient background
    }
  }

  // Gold accent glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.6);
  glow.addColorStop(0, 'rgba(184, 134, 11, 0.15)');
  glow.addColorStop(1, 'rgba(184, 134, 11, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const centerX = W / 2;

  // Logo at top
  let logoBottom = 120;
  if (settings.logoSrc) {
    try {
      const logoImg = await loadImage(settings.logoSrc);
      const logoSize = 90;
      const logoX = centerX - logoSize / 2;
      const logoY = 80;
      ctx.save();
      roundRect(ctx, logoX, logoY, logoSize, logoSize, 16);
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      logoBottom = logoY + logoSize + 20;
    } catch {
      // skip logo
    }
  }

  // "Save the Date" label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9a227';
  ctx.font = '600 22px Georgia, "Times New Roman", serif';
  ctx.letterSpacing = '4px';
  // letterSpacing isn't widely supported on canvas, simulate with manual drawing
  drawSpacedText(ctx, 'SAVE THE DATE', centerX, logoBottom + 20, 4);

  // Decorative line
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - 60, logoBottom + 55);
  ctx.lineTo(centerX + 60, logoBottom + 55);
  ctx.stroke();

  // Small diamond/dot decoration
  ctx.fillStyle = '#c9a227';
  ctx.beginPath();
  ctx.arc(centerX, logoBottom + 55, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bride name
  const nameY = logoBottom + 130;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 72px Georgia, "Times New Roman", serif';
  ctx.fillText(settings.brideName, centerX, nameY);

  // Ampersand with heart
  ctx.fillStyle = '#c9a227';
  ctx.font = 'italic 48px Georgia, serif';
  ctx.fillText('&', centerX, nameY + 75);

  // Groom name
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 72px Georgia, "Times New Roman", serif';
  ctx.fillText(settings.groomName, centerX, nameY + 145);

  // Date
  const dateY = nameY + 220;
  if (settings.weddingDate) {
    const parts = formatDateParts(settings.weddingDate);
    // Day — large gold
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 56px Georgia, serif';
    ctx.fillText(parts.day, centerX - 120, dateY);

    // Month — white
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '400 28px Georgia, serif';
    ctx.fillText(parts.month, centerX, dateY - 12);

    // Year — gold smaller
    ctx.fillStyle = '#c9a227';
    ctx.font = '400 24px Georgia, serif';
    ctx.fillText(parts.year, centerX, dateY + 22);

    // Separator dot between day and month/year cluster
    ctx.fillStyle = 'rgba(201, 162, 39, 0.6)';
    ctx.beginPath();
    ctx.arc(centerX - 55, dateY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Venue
  const venueY = dateY + 80;
  if (settings.venueName) {
    ctx.fillStyle = '#a8a0b0';
    ctx.font = '300 24px Georgia, serif';
    ctx.fillText(settings.venueName, centerX, venueY);
  }
  if (settings.venueAddress) {
    ctx.fillStyle = '#787080';
    ctx.font = '300 18px Georgia, serif';
    ctx.fillText(settings.venueAddress, centerX, venueY + 32);
  }

  // Bottom decorative section
  const bottomY = H - 100;

  // Gold line
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 100, bottomY - 30);
  ctx.lineTo(centerX + 100, bottomY - 30);
  ctx.stroke();

  // "Design by" credit
  ctx.fillStyle = 'rgba(168, 160, 176, 0.7)';
  ctx.font = '300 14px Georgia, serif';
  drawSpacedText(ctx, 'DESIGN BY IGUGU ETIENNE', centerX, bottomY, 2);

  return canvas.toDataURL('image/png');
}

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, spacing: number) {
  // Measure total width with spacing
  const chars = text.split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
  let x = centerX - totalWidth / 2;
  const originalAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + spacing;
  }
  ctx.textAlign = originalAlign;
}

/**
 * Triggers a download of the poster image.
 */
export function downloadPoster(dataUrl: string, filename: string = 'save-the-date.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
