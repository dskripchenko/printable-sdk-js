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
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)` (escape hatch).

Every method resolves with the decoded `payload` of the response envelope.
Errors (non-2xx or `success: false`) reject with `PrintableError`
(`status`, `errorKey`, `payload`).

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
