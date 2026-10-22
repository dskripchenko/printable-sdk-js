# Printable SDK for Node.js

Official Node.js client for the Printable document-generation service
integration API: templates, print-forms, batch rendering, document drafts
and webhook verification — with HMAC request signing (simple and strict
canonical modes) built in and byte-compatible with the server implementation.

> 🌐 **English** · [Deutsch](docs/de/README.md) · [Русский](docs/ru/README.md) · [中文](docs/zh/README.md)

Zero runtime dependencies. Node.js 18+. **Server-side only** — the secret
key must never reach a browser.

## Install

```bash
npm install @dskripchenko/printable-sdk
```

## Quick start

```ts
import { PrintableClient } from '@dskripchenko/printable-sdk';

const client = new PrintableClient({
  baseUrl: 'https://printable.example.com',
  token: 'erp-main-7f3a',
  secretKey: process.env.PRINTABLE_SECRET!,
  salt: process.env.PRINTABLE_SALT!,
  strict: false, // true if the credential has "verify full payload hash" enabled
});

// Render a document
const doc = await client.printFormCreate({
  template: 'invoice',
  variables: { company: { name: 'ACME Ltd' } },
  format: 'link',
});
console.log(doc.link);

// Batch with archive + email delivery
const batch = await client.printFormBatch({
  template: 'certificate',
  items: [{ variables: { name: 'Alice' } }, { variables: { name: 'Bob' } }],
  archive: true,
  deliver: { email: 'hr@example.com' },
});
const status = await client.printFormBatchGet(batch.uuid as string);
```

## API surface

`templateList` · `templateContract` · `templateExport` · `templateImport` ·
`templateImportDocx` · `templateImportXlsx` ·
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormSignatureRequest` · `printFormSignatureComplete` ·
`printFormSignatureInvite` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)` (escape hatch).

Every method resolves with the decoded `payload` of the response envelope.
Errors (non-2xx or `success: false`) reject with `PrintableError`
(`status`, `errorKey`, `payload`).

## Signing and protection

`print-form/create` and `print-form/batch` accept optional parameters, passed as-is in the params:

- `preset` — a print-preset code used instead of `template` (`document-draft/create` accepts it too);
- `signing` — a signature profile per slot, a visible or invisible signature, the reason, and `recipients` — the counterparties who sign the document themselves;
- `protection` — PDF protection: `{"generate": true}` lets the service generate the password, or pass your own one under `password`; the optional `permissions` is `read_print`, `read_only` or `forms_sign`.

The response then carries a `protection` block (`protected`, `permissions`, `password`, `owner_password`). **Passwords are returned only once** — in the response that issues the document; afterwards they come back masked (`••••••••`), so store them right away. Each `signature.slots[]` item may carry `method` (`cms`, `plugin`, `pdf` or `sig`) and `signature_link` — the recipient's detached `.sig`.

```ts
const doc = await client.printFormCreate({
  preset: 'contract-signed',
  variables: { contract: { number: 15 } },
  signing: {
    slots: { company: { profile: 'ceo' } },
    invisible: false,
    reason: 'Contract 15',
    recipients: { buyer: { email: 'buyer@example.com', name: 'Buyer LLC' } },
  },
  protection: { generate: true, permissions: 'read_print' },
});
// The password comes only in this response — store it now
const protection = doc.protection;

// Hand the link over yourself, or let the service email it
const invite = await client.printFormSignatureInvite(doc.uuid as string, 'buyer@example.com', 'buyer', 'Buyer LLC');
console.log(invite.sign_url);
```

`printFormSignatureInvite()` invites the recipient to sign: it returns `sign_url` — a personal link to the signing page (CryptoPro browser plug-in, a detached `.sig` upload, or a PDF signed in its field) — and `expires_at`. With an email address the service also sends the link (`sent`).

## Webhooks

```ts
const valid = client.verifyWebhook(
  rawBody, // raw request body string
  req.headers['x-printable-signature'],
  req.headers['x-printable-timestamp'],
);
```

## Testing your integration

Inject a custom `fetch` to stub HTTP:

```ts
const client = new PrintableClient({
  /* … */
  fetch: async () => new Response('{"success":true,"payload":{"ok":true}}'),
});
```

## License

MIT
