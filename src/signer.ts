import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalize } from './canonical.js';

/**
 * Request/webhook signing, byte-compatible with the Printable server
 * (`App\Auth\HashSigner`).
 */
export class Signer {
  constructor(private readonly salt: string) {
    if (salt === '') {
      throw new Error('Printable salt must not be empty.');
    }
  }

  /** simple mode: sha256(token + timestamp + salt + secret). */
  signToken(token: string, timestamp: number, secretKey: string): string {
    return createHash('sha256').update(`${token}${timestamp}${this.salt}${secretKey}`).digest('hex');
  }

  /** strict mode: HMAC-SHA256(canonical(payload), secret + salt). */
  signPayload(payload: Record<string, unknown>, secretKey: string): string {
    return createHmac('sha256', secretKey + this.salt).update(canonicalize(payload)).digest('hex');
  }

  /** Verify an incoming webhook signature (value without the "sha256=" prefix). */
  verifyWebhook(signature: string, timestamp: number, rawBody: string, secretKey: string): boolean {
    const expected = createHmac('sha256', secretKey).update(`${timestamp}.${rawBody}`).digest('hex');
    if (signature.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
