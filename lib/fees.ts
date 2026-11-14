/**
 * Single source of truth for what Reclaimng charges. The UI, the Paystack
 * checkout and the server-side payment checks all read from here, so a price
 * can never be shown as one amount and charged as another.
 */
export const FEES = {
  /** One-off identity check against the national identity database. */
  identity: { kobo: 500_000, label: 'Identity check' },
  /** Document review and filing of the recovery request. */
  submission: { kobo: 7_500_000, label: 'Document review and filing' },
  /** Share of recovered funds, charged only when money is actually recovered. */
  successRate: 0.1,
} as const;

export type FeePurpose = 'identity' | 'submission';

export const SUPPORT_WHATSAPP = 'https://wa.me/2348135975351';
export const SUPPORT_WHATSAPP_DISPLAY = '+234 813 597 5351';

export const UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
  accept: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
} as const;
