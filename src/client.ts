import { Signer } from './signer.js';

export interface PrintableClientOptions {
  /** Installation origin, e.g. `https://printable.example.com`. */
  baseUrl: string;
  token: string;
  secretKey: string;
  salt: string;
  /** true when the credential requires full-payload HMAC verification. */
  strict?: boolean;
  timeoutMs?: number;
  /** Custom fetch implementation (testing / instrumentation). */
  fetch?: typeof fetch;
}

export class PrintableError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorKey: string | null = null,
    public readonly payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PrintableError';
  }
}

type Payload = Record<string, unknown>;

/**
 * Client for the Printable integration API (`/api/integration`).
 * Server-side only: the secret key must never reach a browser.
 */
export class PrintableClient {
  private readonly signer: Signer;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PrintableClientOptions) {
    this.signer = new Signer(options.salt);
    this.fetchImpl = options.fetch ?? fetch;
  }

  // ── Templates ──────────────────────────────────────────────────────

  templateList(): Promise<Payload> {
    return this.call('GET', 'template/list');
  }

  templateContract(template: string, version?: string): Promise<Payload> {
    return this.call('GET', 'template/contract', version ? { template, version } : { template });
  }

  templateExport(template: string, version?: string): Promise<Payload> {
    return this.call('GET', 'template/export', version ? { template, version } : { template });
  }

  templateImport(
    packageB64: string,
    groupId: number,
    options: { deps?: string; on_conflict?: string } = {},
  ): Promise<Payload> {
    return this.call('POST', 'template/import', { ...options, package_b64: packageB64, group_id: groupId });
  }

  // ── Print forms ────────────────────────────────────────────────────

  printFormCreate(params: Payload): Promise<Payload> {
    return this.call('POST', 'print-form/create', params);
  }

  printFormGet(uuid: string, format: 'link' | 'b64' = 'link'): Promise<Payload> {
    return this.call('GET', 'print-form/get', { uuid, format });
  }

  printFormRules(template: string, version?: string): Promise<Payload> {
    return this.call('GET', 'print-form/rules', version ? { template, version } : { template });
  }

  printFormBatch(params: Payload): Promise<Payload> {
    return this.call('POST', 'print-form/batch', params);
  }

  printFormBatchGet(uuid: string): Promise<Payload> {
    return this.call('GET', 'print-form/batch-get', { uuid });
  }

  // ── Document drafts ────────────────────────────────────────────────

  documentDraftCreate(params: Payload): Promise<Payload> {
    return this.call('POST', 'document-draft/create', params);
  }

  documentDraftGet(uuid: string): Promise<Payload> {
    return this.call('GET', 'document-draft/get', { uuid });
  }

  // ── Webhooks ───────────────────────────────────────────────────────

  /** Verify an incoming Printable webhook against its signature headers. */
  verifyWebhook(rawBody: string, signatureHeader: string, timestampHeader: string | number): boolean {
    const signature = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
    return this.signer.verifyWebhook(signature, Number(timestampHeader), rawBody, this.options.secretKey);
  }

  // ── Core ───────────────────────────────────────────────────────────

  /** Generic escape hatch: signed call to any `{controller}/{action}`. */
  async call(method: 'GET' | 'POST', endpoint: string, params: Payload = {}): Promise<Payload> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: Payload = { ...params, timestamp };

    const hash = this.options.strict
      ? this.signer.signPayload(payload, this.options.secretKey)
      : this.signer.signToken(this.options.token, timestamp, this.options.secretKey);

    const body: Payload = { ...payload, token: this.options.token, hash };
    let url = this.options.baseUrl.replace(/\/+$/, '') + '/api/integration/' + endpoint.replace(/^\/+/, '');

    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    };
    if (method === 'GET') {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        query.set(key, String(value));
      }
      url += '?' + query.toString();
    } else {
      init.body = JSON.stringify(body);
    }

    const response = await this.fetchImpl(url, init);
    let decoded: { success?: boolean; payload?: Payload };
    try {
      decoded = (await response.json()) as { success?: boolean; payload?: Payload };
    } catch {
      throw new PrintableError(`Printable API returned a non-JSON response (HTTP ${response.status})`, response.status);
    }

    const payloadOut = decoded.payload ?? {};
    if (response.status >= 400 || decoded.success !== true) {
      throw new PrintableError(
        typeof payloadOut.message === 'string' ? payloadOut.message : `Printable API error (HTTP ${response.status})`,
        response.status,
        typeof payloadOut.errorKey === 'string' ? payloadOut.errorKey : null,
        payloadOut,
      );
    }
    return payloadOut;
  }
}
