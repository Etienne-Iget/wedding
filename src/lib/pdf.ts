import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Invitation, WeddingSettings, Guest, TableEntity, Beverage, Rsvp } from '@/types';

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });
}

interface PdfData {
  settings: WeddingSettings | null;
  invitations: Invitation[];
  guests: Guest[];
  rsvps: Rsvp[];
  tables: TableEntity[];
  beverages: Beverage[];
}

export async function generateQrInvitationsPdf(data: PdfData): Promise<void> {
  const { invitations, settings, guests } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const cardW = (pageW - margin * 2 - 8) / 2;
  const cardH = 70;
  const gutter = 8;
  let x = margin;
  let y = margin;

  for (let i = 0; i < invitations.length; i++) {
    const inv = invitations[i];
    const people = guests.filter((g) => g.invitationId === inv.id);
    const qrText = `${inv.invitationNumber}|${inv.qrToken}`;
    const qrData = await generateQrDataUrl(qrText);

    if (y + cardH > pageH - margin) {
      doc.addPage();
      x = margin;
      y = margin;
    }

    doc.setDrawColor(184, 134, 11);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');

    if (settings?.logoSrc) {
      try {
        const fmt = settings.logoSrc.includes('.png') ? 'PNG' : 'JPEG';
        doc.addImage(settings.logoSrc, fmt, x + 4, y + 3, 8, 8);
      } catch { /* skip */ }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 26);
    doc.text(settings ? `${settings.brideName} & ${settings.groomName}` : 'Notre Mariage', x + (settings?.logoSrc ? 14 : 4), y + 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    if (settings?.weddingDate) {
      const timeStr = settings.events?.dot?.time ? ` à ${formatTime(settings.events.dot.time)}` : '';
      doc.text(`${formatDate(settings.weddingDate)}${timeStr}`, x + 4, y + 13);
    }

    doc.addImage(qrData, 'PNG', x + cardW - 34, y + 6, 28, 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(26, 26, 26);
    doc.text(inv.invitationNumber, x + 4, y + 22);
    doc.text(inv.familyName, x + 4, y + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Personnes autorisées: ${inv.maxPeople}`, x + 4, y + 34);
    if (people.length > 0) {
      doc.text(`Inscrits: ${people.length}`, x + 4, y + 39);
    }
    if (inv.contactPhone) {
      doc.text(`Tél: ${inv.contactPhone}`, x + 4, y + 44);
    }

    let py = y + 50;
    for (const p of people.slice(0, 4)) {
      doc.text(`• ${p.firstName} ${p.lastName}${p.isChild ? ' (enfant)' : ''}`, x + 4, py);
      py += 4;
    }

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Token: ${inv.qrToken.slice(0, 12)}...`, x + 4, y + cardH - 4);

    x += cardW + gutter;
    if (x + cardW > pageW - margin) {
      x = margin;
      y += cardH + gutter;
    }
  }

  doc.save('qr-invitations.pdf');
}

export async function generateSeatingPdf(data: PdfData): Promise<void> {
  const { tables, guests, invitations, settings } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text('Plan de tables', margin, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  if (settings) {
    doc.text(`${settings.brideName} & ${settings.groomName} — ${formatDate(settings.weddingDate)}`, margin, 26);
  }

  let y = 36;
  const invById = new Map(invitations.map((i) => [i.id, i]));
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name));

  for (const t of sorted) {
    if (y > 270) { doc.addPage(); y = 20; }
    const tableGuests = guests
      .filter((g) => g.tableId === t.id)
      .sort((a, b) => (a.seatNumber ?? 999) - (b.seatNumber ?? 999));

    doc.setFillColor(245, 241, 232);
    doc.rect(margin, y, pageW - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 26);
    doc.text(`${t.name}  (${tableGuests.length}/${t.capacity})`, margin + 2, y + 5.5);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    for (const g of tableGuests) {
      if (y > 285) { doc.addPage(); y = 20; }
      const inv = invById.get(g.invitationId);
      const seat = g.seatNumber ? `Place ${g.seatNumber}` : '—';
      doc.text(`  ${seat}  —  ${g.firstName} ${g.lastName}${inv ? `  (${inv.familyName})` : ''}${g.isChild ? '  (enfant)' : ''}`, margin + 2, y);
      y += 4.5;
    }
    y += 6;
  }

  doc.save('plan-tables.pdf');
}

export async function generateBeveragePdf(data: PdfData): Promise<void> {
  const { guests, beverages, invitations, tables } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text('Plan boissons', margin, 20);

  const bevById = new Map(beverages.map((b) => [b.id, b]));
  const totals = new Map<string, { category: string; total: number }>();
  for (const g of guests) {
    if (!g.beverageId) continue;
    const bev = bevById.get(g.beverageId);
    if (!bev) continue;
    const qty = g.beverageQuantity ?? 1;
    const cur = totals.get(bev.name);
    if (cur) cur.total += qty;
    else totals.set(bev.name, { category: bev.category, total: qty });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Récapitulatif', margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 40;
  for (const [name, info] of totals) {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${name} (${info.category})`, margin, y);
    doc.text(`${info.total}`, pageW - margin - 10, y, { align: 'right' });
    y += 6;
  }

  y += 10;
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Détail par invité', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const invById = new Map(invitations.map((i) => [i.id, i]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  for (const g of guests) {
    if (!g.beverageId) continue;
    if (y > 285) { doc.addPage(); y = 20; }
    const bev = bevById.get(g.beverageId);
    const table = g.tableId ? tableById.get(g.tableId) : undefined;
    doc.text(`${g.firstName} ${g.lastName} — ${table?.name ?? ''} — ${bev?.name ?? ''} x${g.beverageQuantity ?? 1}`, margin, y);
    y += 5;
  }

  doc.save('plan-boissons.pdf');
}

export async function generateGuestListPdf(data: PdfData): Promise<void> {
  const { guests, invitations, rsvps, settings } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text("Liste des invités", margin, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  if (settings) {
    doc.text(`${settings.brideName} & ${settings.groomName} — ${formatDate(settings.weddingDate)}`, margin, 26);
  }

  const invById = new Map(invitations.map((i) => [i.id, i]));
  const rsvpByInv = new Map(rsvps.map((r) => [r.invitationId, r]));
  const sorted = [...guests].sort((a, b) => {
    const invA = invById.get(a.invitationId)?.familyName ?? '';
    const invB = invById.get(b.invitationId)?.familyName ?? '';
    return invA.localeCompare(invB) || a.firstName.localeCompare(b.firstName);
  });

  let y = 36;
  doc.setFontSize(9);
  for (const g of sorted) {
    if (y > 285) { doc.addPage(); y = 20; }
    const inv = invById.get(g.invitationId);
    const rsvp = inv ? rsvpByInv.get(inv.id) : undefined;
    const status = rsvp?.status === 'confirmed' ? 'OUI' : rsvp?.status === 'declined' ? 'NON' : '—';
    doc.setTextColor(60, 60, 60);
    doc.text(`${inv?.invitationNumber ?? ''}`, margin, y);
    doc.text(`${inv?.familyName ?? ''}`, margin + 22, y);
    doc.text(`${g.firstName} ${g.lastName}`, margin + 60, y);
    doc.text(status, pageW - margin - 10, y, { align: 'right' });
    y += 5;
  }

  doc.save('liste-invites.pdf');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(t: string): string {
  if (!t) return '';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, '0');
  if (isNaN(h) || h < 0 || h > 23) h = 0;
  return `${String(h).padStart(2, '0')}h${m}`;
}
