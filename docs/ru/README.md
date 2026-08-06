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
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)`

Каждый метод разрешается раскодированным `payload` из конверта ответа.
Ошибки (не-2xx или `success: false`) отклоняются с `PrintableError`
(`status`, `errorKey`, `payload`).

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
