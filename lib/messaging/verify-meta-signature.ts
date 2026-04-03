import { createHmac } from 'crypto';

/**
 * Verify the X-Hub-Signature-256 header that Meta sends on every webhook POST.
 * Returns true if the signature matches, false otherwise.
 *
 * Requires META_APP_SECRET (your Facebook/Meta app secret) in env.
 * If the env var is not set, logs a warning and rejects (fail-closed).
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.warn('[Meta Signature] META_APP_SECRET not set — rejecting payload (fail-closed)');
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const received = signatureHeader.slice('sha256='.length);

  if (expected.length !== received.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return mismatch === 0;
}
