# Printable SDK for Node.js

面向文档生成服务 [Printable](https://printable.dev-cloud.space) 集成 API 的官方 Node.js 客户端：
模板、打印表单、批量渲染、文档草稿以及 webhook 校验。HMAC 请求签名
（简单模式与严格规范模式）已内置，并与服务端实现逐字节一致。

> 🌐 [English](../../README.md) · [Deutsch](../de/README.md) · [Русский](../ru/README.md) · **中文**

运行时零依赖。Node.js 18+。**仅限服务端**——密钥绝不能进入浏览器。

## 安装

```bash
npm install @dskripchenko/printable-sdk
```

## 快速开始

```ts
import { PrintableClient } from '@dskripchenko/printable-sdk';

const client = new PrintableClient({
  baseUrl: 'https://printable.example.com',
  token: 'erp-main-7f3a',
  secretKey: process.env.PRINTABLE_SECRET!,
  salt: process.env.PRINTABLE_SALT!,
  strict: false, // 若该凭据开启了“校验完整载荷哈希”，则填 true
});

// 渲染一份文档
const doc = await client.printFormCreate({
  template: 'invoice',
  variables: { company: { name: 'ACME Ltd' } },
  format: 'link',
});
console.log(doc.link);

// 批量生成，打包并邮件送达
const batch = await client.printFormBatch({
  template: 'certificate',
  items: [{ variables: { name: 'Alice' } }, { variables: { name: 'Bob' } }],
  archive: true,
  deliver: { email: 'hr@example.com' },
});
const status = await client.printFormBatchGet(batch.uuid as string);
```

## API 一览

`templateList` · `templateContract` · `templateExport` · `templateImport` ·
`templateImportDocx` · `templateImportXlsx` ·
`printFormCreate` · `printFormGet` · `printFormRules` · `printFormBatch` ·
`printFormSignatureRequest` · `printFormSignatureComplete` ·
`printFormBatchGet` · `documentDraftCreate` · `documentDraftGet` ·
`call(method, endpoint, params)`

每个方法都以响应信封中解码后的 `payload` 兑现。
出错时（非 2xx 或 `success: false`）以 `PrintableError`（`status`、`errorKey`、`payload`）拒绝。

## Webhook

```ts
const valid = client.verifyWebhook(
  rawBody, // raw request body string
  req.headers['x-printable-signature'],
  req.headers['x-printable-timestamp'],
);
```

## 为集成打桩测试

注入自定义的 `fetch` 即可为 HTTP 打桩：

```ts
const client = new PrintableClient({
  /* … */
  fetch: async () => new Response('{"success":true,"payload":{"ok":true}}'),
});
```

## 许可证

MIT
