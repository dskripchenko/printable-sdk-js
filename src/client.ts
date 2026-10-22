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

  /**
   * Importing a Word document as a template draft.
   *
   * Available to a credential with full access and only where it is enabled on
   * the installation: otherwise the service answers `docx-import-disabled`.
   */
  templateImportDocx(docxB64: string, groupId: number, name?: string): Promise<Payload> {
    const body: Payload = { docx_b64: docxB64, group_id: groupId }
    // We do not send an empty name: the service would reject it on format
    // rather than accept it as "a template with no title".
    if (name !== undefined) body.name = name

    return this.call('POST', 'template/import-docx', body)
  }

  /**
   * Importing an Excel workbook (.xlsx) as a template draft: one section per
   * non-empty sheet, printed at the sheet's own print scale.
   *
   * The group is an existing group's id, or a path ("Реестры / Отчёты") the
   * service creates when it is missing.
   */
  templateImportXlsx(xlsxB64: string, group: number | string, name?: string): Promise<Payload> {
    const body: Payload = { xlsx_b64: xlsxB64 }
    if (typeof group === 'number') body.group_id = group
    else body.group = group
    if (name !== undefined) body.name = name

    return this.call('POST', 'template/import-xlsx', body)
  }

  // ── Print forms ────────────────────────────────────────────────────

  printFormCreate(params: Payload): Promise<Payload> {
    return this.call('POST', 'print-form/create', params);
  }

  printFormGet(uuid: string, format: 'link' | 'b64' = 'link'): Promise<Payload> {
    return this.call('GET', 'print-form/get', { uuid, format });
  }

  /**
   * Asking for the digest an external signer signs: for a document in
   * `awaiting_signature`, with the signer's certificate (PEM, or DER in base64
   * as CryptoPro exports it). Sign the digest into a detached CMS and pass it
   * to `printFormSignatureComplete()` before `expires_at`. Without `slot` —
   * the signature field the document waits for.
   */
  printFormSignatureRequest(uuid: string, certificate: string, slot?: string): Promise<Payload> {
    const body: Payload = { uuid, certificate }
    if (slot !== undefined) body.slot = slot

    return this.call('POST', 'print-form/signature-request', body)
  }

  /**
   * Handing in the external signature: the detached CMS (base64 or PEM) for
   * the digest of `printFormSignatureRequest()`. The answer is the document —
   * `done` when every signature is in, else still `awaiting_signature`.
   */
  printFormSignatureComplete(uuid: string, cms: string, slot?: string, format: 'link' | 'b64' = 'link'): Promise<Payload> {
    const body: Payload = { uuid, cms, format }
    if (slot !== undefined) body.slot = slot

    return this.call('POST', 'print-form/signature-complete', body)
  }

  /**
   * Inviting the document's recipient to sign it themselves: the service
   * issues a personal link to a signing page (CryptoPro browser plug-in, a
   * detached .sig upload, or a PDF signed in its field). With `email` the
   * service also sends the link by email. Without `slot` — the signature field
   * the document waits for. Resolves with `uuid`, `slot`, `sign_url`,
   * `expires_at`, `sent`.
   */
  printFormSignatureInvite(uuid: string, email?: string, slot?: string, name?: string): Promise<Payload> {
    const body: Payload = { uuid }
    if (slot !== undefined) body.slot = slot
    if (email !== undefined) body.email = email
    if (name !== undefined) body.name = name

    return this.call('POST', 'print-form/signature-invite', body)
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
