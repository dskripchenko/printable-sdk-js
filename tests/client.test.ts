import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrintableClient, PrintableError } from '../src/client.js';
import { Signer } from '../src/signer.js';

interface Captured {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

function makeClient(options: { strict?: boolean; status?: number; response?: string } = {}) {
  const captured: Captured[] = [];
  const client = new PrintableClient({
    baseUrl: 'https://printable.test',
    token: 'tok-1',
    secretKey: 'sec-1',
    salt: 'salt-123',
    strict: options.strict ?? false,
    fetch: (async (url: string, init: RequestInit) => {
      captured.push({
        url: String(url),
        method: init.method ?? 'GET',
        body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
      });
      return new Response(options.response ?? '{"success":true,"payload":{"ok":1}}', {
        status: options.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { client, captured };
}

describe('PrintableClient', () => {
  it('POST call sends signed body with simple-mode hash', async () => {
    const { client, captured } = makeClient();
    const payload = await client.printFormCreate({ template: 'invoice', variables: { a: 1 } });

    expect(payload).toEqual({ ok: 1 });
    const request = captured[0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://printable.test/api/integration/print-form/create');
    const body = request.body as Record<string, unknown>;
    expect(body.token).toBe('tok-1');
    expect(body.hash).toBe(new Signer('salt-123').signToken('tok-1', body.timestamp as number, 'sec-1'));
  });

  it('strict mode signs the full payload without token/hash', async () => {
    const { client, captured } = makeClient({ strict: true });
    await client.printFormCreate({ template: 'invoice' });

    const body = { ...(captured[0].body as Record<string, unknown>) };
    const { token: _t, hash, ...signedPayload } = body;
    expect(hash).toBe(new Signer('salt-123').signPayload(signedPayload, 'sec-1'));
  });

  it('GET call puts auth into the query string', async () => {
    const { client, captured } = makeClient();
    await client.printFormGet('0f8fad5b-d9cb-469f-a165-70867728950e');

    const request = captured[0];
    expect(request.method).toBe('GET');
    expect(request.body).toBeNull();
    const url = new URL(request.url);
    expect(url.searchParams.get('uuid')).toBe('0f8fad5b-d9cb-469f-a165-70867728950e');
    expect(url.searchParams.get('token')).toBe('tok-1');
    expect(url.searchParams.get('hash')).toBeTruthy();
    expect(url.searchParams.get('timestamp')).toBeTruthy();
  });

  it('error envelope raises PrintableError with errorKey', async () => {
    const { client } = makeClient({
      status: 401,
      response: '{"success":false,"payload":{"errorKey":"auth-token-invalid","message":"Bad token"}}',
    });

    await expect(client.templateList()).rejects.toMatchObject({
      name: 'PrintableError',
      status: 401,
      errorKey: 'auth-token-invalid',
      message: 'Bad token',
    });
  });

  it('non-JSON response raises PrintableError', async () => {
    const { client } = makeClient({ status: 502, response: '<html>Bad gateway</html>' });
    await expect(client.templateList()).rejects.toBeInstanceOf(PrintableError);
  });

  it('verifyWebhook accepts the sha256= prefixed header', () => {
    const { client } = makeClient();
    const sig = 'sha256=' + createHmac('sha256', 'sec-1').update('1753600000.{"uuid":"abc"}').digest('hex');
    expect(client.verifyWebhook('{"uuid":"abc"}', sig, '1753600000')).toBe(true);
    expect(client.verifyWebhook('{"uuid":"abc"}', 'sha256=deadbeef', '1753600000')).toBe(false);
  });
});
