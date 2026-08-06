# Printable-SDK für Node.js

Offizieller Node.js-Client für die Integrations-API des Dokumentendienstes
[Printable](https://printable.dev-cloud.space): Vorlagen, Druckformulare,
Stapelverarbeitung, Dokumententwürfe und Webhook-Prüfung. Die HMAC-Signatur der
Anfragen (einfacher und strenger kanonischer Modus) ist eingebaut und
byteweise identisch mit der Server-Implementierung.

> 🌐 [English](../../README.md) · **Deutsch** · [Русский](../ru/README.md) · [中文](../zh/README.md)

Keine Laufzeitabhängigkeiten. Node.js 18+. **Nur serverseitig** — der
geheime Schlüssel darf nie in einen Browser gelangen.

## Installation

```bash
npm install @dskripchenko/printable-sdk
```

## Schnellstart

```ts
import { PrintableClient } from '@dskripchenko/printable-sdk';

const client = new PrintableClient({
  baseUrl: 'https://printable.example.com',
  token: 'erp-main-7f3a',
  secretKey: process.env.PRINTABLE_SECRET!,
  salt: process.env.PRINTABLE_SALT!,
  strict: false, // true, wenn für den Zugang „gesamten Payload-Hash prüfen“ aktiv ist
});

// Ein Dokument rendern
const doc = await client.printFormCreate({
  template: 'invoice',
  variables: { company: { name: 'ACME Ltd' } },
  format: 'link',
});
console.log(doc.link);

// Stapel mit Archiv und E-Mail-Versand
const batch = await client.printFormBatch({
  template: 'certificate',
  items: [{ variables: { name: 'Alice' } }, { variables: { name: 'Bob' } }],
  archive: true,
  deliver: { email: 'hr@example.com' },
});
const status = await client.printFormBatchGet(batch.uuid as string);
```

## API-Oberfläche

`templateList` · `templateContract` · `templateExport` · `templateImport` ·
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)`

Jede Methode löst mit dem dekodierten `payload` des Antwort-Umschlags auf.
Fehler (nicht-2xx oder `success: false`) werden mit `PrintableError`
(`status`, `errorKey`, `payload`) abgelehnt.

## Webhooks

```ts
const valid = client.verifyWebhook(
  rawBody, // raw request body string
  req.headers['x-printable-signature'],
  req.headers['x-printable-timestamp'],
);
```

## Integration testen

Injizieren Sie ein eigenes `fetch`, um HTTP zu stubben:

```ts
const client = new PrintableClient({
  /* … */
  fetch: async () => new Response('{"success":true,"payload":{"ok":true}}'),
});
```

## Lizenz

MIT
