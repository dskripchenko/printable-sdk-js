# Printable SDK для Node.js

Официальный клиент на Node.js к интеграционному API сервиса генерации документов
[Printable](https://printable.dev-cloud.space): шаблоны, печатные формы, пакетная
печать, черновики документов и проверка вебхуков. Подпись запросов HMAC
(простой и строгий канонический режимы) встроена и побайтово совпадает с
серверной реализацией.

> 🌐 [English](../../README.md) · [Deutsch](../de/README.md) · **Русский** · [中文](../zh/README.md)

Никаких зависимостей в рантайме. Node.js 18+. **Только на сервере** —
секретный ключ не должен попадать в браузер.

## Установка

```bash
npm install @dskripchenko/printable-sdk
```

## Быстрый старт

```ts
import { PrintableClient } from '@dskripchenko/printable-sdk';

const client = new PrintableClient({
  baseUrl: 'https://printable.example.com',
  token: 'erp-main-7f3a',
  secretKey: process.env.PRINTABLE_SECRET!,
  salt: process.env.PRINTABLE_SALT!,
  strict: false, // true, если у ключа включена «проверка хеша всего тела»
});

// Печать документа
const doc = await client.printFormCreate({
  template: 'invoice',
  variables: { company: { name: 'ACME Ltd' } },
  format: 'link',
});
console.log(doc.link);

// Пакет с архивом и отправкой на почту
const batch = await client.printFormBatch({
  template: 'certificate',
  items: [{ variables: { name: 'Alice' } }, { variables: { name: 'Bob' } }],
  archive: true,
  deliver: { email: 'hr@example.com' },
});
const status = await client.printFormBatchGet(batch.uuid as string);
```

## Поверхность API

`templateList` · `templateContract` · `templateExport` · `templateImport` ·
`templateImportDocx` · `templateImportXlsx` ·
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormSignatureRequest` · `printFormSignatureComplete` ·
`printFormSignatureInvite` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)`

Каждый метод разрешается раскодированным `payload` из конверта ответа.
Ошибки (не-2xx или `success: false`) отклоняются с `PrintableError`
(`status`, `errorKey`, `payload`).

## Подпись и защита

`print-form/create` и `print-form/batch` принимают необязательные параметры — они передаются в params как есть:

- `preset` — код пресета печати вместо `template` (его принимает и `document-draft/create`);
- `signing` — профиль подписи для каждого поля, видимая или невидимая подпись, основание и `recipients` — контрагенты, которые подписывают документ сами;
- `protection` — защита PDF: `{"generate": true}` — пароль сгенерирует сервис, либо свой пароль в поле `password`; необязательное `permissions` — `read_print`, `read_only` или `forms_sign`.

В ответе тогда есть блок `protection` (`protected`, `permissions`, `password`, `owner_password`). **Пароли приходят только один раз** — в ответе, который выпускает документ; дальше они замаскированы (`••••••••`), так что сохраните их сразу. У каждого элемента `signature.slots[]` могут быть `method` (`cms`, `plugin`, `pdf` или `sig`) и `signature_link` — отделённая `.sig` получателя.

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
// Пароль приходит только в этом ответе — сохраните его сейчас
const protection = doc.protection;

// Передайте ссылку сами или дайте сервису отправить её письмом
const invite = await client.printFormSignatureInvite(doc.uuid as string, 'buyer@example.com', 'buyer', 'Buyer LLC');
console.log(invite.sign_url);
```

`printFormSignatureInvite()` приглашает получателя подписать документ: возвращает `sign_url` — персональную ссылку на страницу подписи (плагин КриптоПро в браузере, загрузка отделённой `.sig` или PDF, подписанный в своём поле) — и `expires_at`. С адресом почты сервис ещё и отправит ссылку письмом (`sent`).

## Вебхуки

```ts
const valid = client.verifyWebhook(
  rawBody, // raw request body string
  req.headers['x-printable-signature'],
  req.headers['x-printable-timestamp'],
);
```

## Проверка интеграции

Подставьте свой `fetch`, чтобы заглушить HTTP:

```ts
const client = new PrintableClient({
  /* … */
  fetch: async () => new Response('{"success":true,"payload":{"ok":true}}'),
});
```

## Лицензия

MIT
