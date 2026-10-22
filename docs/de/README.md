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
`templateImportDocx` · `templateImportXlsx` ·
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormSignatureRequest` · `printFormSignatureComplete` ·
`printFormSignatureInvite` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)`

Jede Methode löst mit dem dekodierten `payload` des Antwort-Umschlags auf.
Fehler (nicht-2xx oder `success: false`) werden mit `PrintableError`
(`status`, `errorKey`, `payload`) abgelehnt.

## Signatur und Schutz

`print-form/create` und `print-form/batch` akzeptieren optionale Parameter, die unverändert in den params übergeben werden:

- `preset` — der Code einer Druckvorgabe anstelle von `template` (auch `document-draft/create` akzeptiert ihn);
- `signing` — ein Signaturprofil je Feld, eine sichtbare oder unsichtbare Signatur, der Grund und `recipients` — die Gegenparteien, die das Dokument selbst signieren;
- `protection` — PDF-Schutz: `{"generate": true}` lässt den Dienst das Passwort erzeugen, alternativ ein eigenes im Feld `password`; das optionale `permissions` ist `read_print`, `read_only` oder `forms_sign`.

Die Antwort enthält dann einen Block `protection` (`protected`, `permissions`, `password`, `owner_password`). **Passwörter werden nur einmal geliefert** — in der Antwort, die das Dokument ausstellt; danach kommen sie maskiert (`••••••••`), also sofort speichern. Jedes Element von `signature.slots[]` kann `method` (`cms`, `plugin`, `pdf` oder `sig`) und `signature_link` tragen — die abgetrennte `.sig` des Empfängers.

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
// Das Passwort kommt nur in dieser Antwort — jetzt speichern
const protection = doc.protection;

// Den Link selbst weitergeben oder vom Dienst per E-Mail senden lassen
const invite = await client.printFormSignatureInvite(doc.uuid as string, 'buyer@example.com', 'buyer', 'Buyer LLC');
console.log(invite.sign_url);
```

`printFormSignatureInvite()` lädt den Empfänger zur Signatur ein: Es liefert `sign_url` — einen persönlichen Link zur Signaturseite (CryptoPro-Browser-Plug-in, Upload einer abgetrennten `.sig` oder ein im eigenen Feld signiertes PDF) — und `expires_at`. Mit einer E-Mail-Adresse verschickt der Dienst den Link auch per E-Mail (`sent`).

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
