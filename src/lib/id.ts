// Tiny helpers for generating unique ids and invitation numbers.

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateQrToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatInvitationNumber(n: number): string {
  return `INV-${String(n).padStart(3, '0')}`;
}

export function nextInvitationNumber(existing: { invitationNumber: string }[]): string {
  let max = 0;
  for (const inv of existing) {
    const match = inv.invitationNumber.match(/INV-(\d+)/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return formatInvitationNumber(max + 1);
}
