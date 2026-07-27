import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/canonical.js';
import { Signer } from '../src/signer.js';

/**
 * Vectors generated from the Printable server implementation
 * (App\Auth\HashSigner, salt-123 / sec-1) — byte-compatibility contract.
 */
const SALT = 'salt-123';
const SECRET = 'sec-1';

const vectors: Array<{ name: string; payload: Record<string, unknown>; canonical: string; hash: string }> = [
  {
    name: 'sorted keys + list preserved',
    payload: { b: 1, a: 'x', nested: { z: true, a: [3, 1, 2] } },
    canonical: '{"a":"x","b":1,"nested":{"a":[3,1,2],"z":true}}',
    hash: 'f14fc443af8b3891f927aeb32c725923a4dc42fbf78eba2ce1439940be4ec5c2',
  },
  {
    name: 'unicode + numeric string',
    payload: {
      template: 'invoice',
      timestamp: 1753600000,
      variables: { user: { name: 'Иван/Ко', age: '42' } },
    },
    canonical: '{"template":"invoice","timestamp":1753600000,"variables":{"user":{"age":42,"name":"Иван/Ко"}}}',
    hash: '3ede97642552144bbb774d077f56bc9c5fc9fe16e8d529a1941d7d155dd3faa6',
  },
  {
    name: 'numeric-check edge cases',
    payload: { num_str: '100.0', exp: '1e3', zeros: '007', plain: 'text', empty_obj: {}, empty_arr: [] },
    canonical: '{"empty_arr":[],"empty_obj":[],"exp":1000,"num_str":100,"plain":"text","zeros":7}',
    hash: '35698b058d732971e4f74a3ef78db7ea1662b5758e03f353500dc2f9f7448be4',
  },
  {
    name: 'nested objects in list + null + false',
    payload: { list: { b: 2, items: [{ k: 'v', a: 1 }, { x: null }] }, flag: false },
    canonical: '{"flag":false,"list":{"b":2,"items":[{"a":1,"k":"v"},{"x":null}]}}',
    hash: 'be151b065cdd8f2eb10d79a463ddc7467a185d154255fb427335574b8acbc845',
  },
];

describe('canonicalize', () => {
  it.each(vectors)('$name', ({ payload, canonical }) => {
    expect(canonicalize(payload)).toBe(canonical);
  });

  it('treats sequential-key objects as arrays (PHP semantics)', () => {
    expect(canonicalize({ list: { '0': 'a', '1': 'b' } })).toBe('{"list":["a","b"]}');
  });
});

describe('Signer', () => {
  const signer = new Signer(SALT);

  it('signToken matches the server simple-mode formula', () => {
    expect(signer.signToken('tok-1', 1753600000, SECRET)).toBe(
      'bf9a3d9e15dbac35b13b0324bac385564bcec7a1d9f4fc56c7da5293da3ebf02',
    );
  });

  it.each(vectors)('signPayload: $name', ({ payload, hash }) => {
    expect(signer.signPayload(payload, SECRET)).toBe(hash);
  });

  it('verifyWebhook matches the server webhook signature', () => {
    expect(
      signer.verifyWebhook(
        '7641aadedab7b606585ba0c68ddfe4583b778b7a9bef62c700c76f9596dc9141',
        1753600000,
        '{"uuid":"abc"}',
        SECRET,
      ),
    ).toBe(true);
    expect(signer.verifyWebhook('deadbeef', 1753600000, '{"uuid":"abc"}', SECRET)).toBe(false);
  });

  it('rejects an empty salt', () => {
    expect(() => new Signer('')).toThrow();
  });
});
