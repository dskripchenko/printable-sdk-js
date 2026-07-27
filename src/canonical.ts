/**
 * PHP-compatible payload canonicalization — byte-identical to the Printable
 * server (`App\Auth\HashSigner::canonicalize`):
 *
 *  - recursive key sort for objects (arrays keep their order);
 *  - PHP `JSON_NUMERIC_CHECK` semantics: numeric strings become numbers
 *    ("42" → 42, "100.0" → 100, "1e3" → 1000, "007" → 7);
 *  - empty objects encode as `[]` (PHP array semantics);
 *  - objects with sequential "0".."n" keys encode as arrays;
 *  - unicode and slashes are not escaped.
 *
 * Known limitation (same as PHP): integers beyond 2^53 lose precision.
 */

/** PHP `is_numeric` for strings (PHP 8: leading/trailing whitespace allowed). */
const NUMERIC_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

function isNumericString(value: string): boolean {
  return NUMERIC_RE.test(value.trim()) && value.trim() !== '';
}

function isSequentialKeys(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return false;
  }
  return keys.every((key, index) => key === String(index));
}

function encode(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  if (typeof value === 'string') {
    if (isNumericString(value)) {
      return String(Number(value.trim()));
    }
    return encodeString(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(encode).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    // PHP: пустой объект после json_decode(assoc) — пустой array → "[]".
    if (keys.length === 0) {
      return '[]';
    }
    // Объект с ключами "0".."n" PHP считает списком.
    if (isSequentialKeys(obj)) {
      return '[' + keys.map((k) => encode(obj[k])).join(',') + ']';
    }
    const sorted = phpKsort(keys);
    return '{' + sorted.map((k) => encodeString(k) + ':' + encode(obj[k])).join(',') + '}';
  }
  return 'null';
}

/**
 * PHP ksort (SORT_REGULAR): числовые ключи сравниваются как числа,
 * прочие — как строки; числовые всегда раньше строковых при сравнении
 * числа со строкой числовая семантика PHP8 — для API-payload'ов ключи
 * практически всегда строковые, обычной сортировки достаточно.
 */
function phpKsort(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const an = isNumericString(a);
    const bn = isNumericString(b);
    if (an && bn) {
      return Number(a) - Number(b);
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** JSON string escaping как в PHP с UNESCAPED_UNICODE|UNESCAPED_SLASHES. */
function encodeString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case '\\':
        out += '\\\\';
        break;
      case '\b':
        out += '\\b';
        break;
      case '\f':
        out += '\\f';
        break;
      case '\n':
        out += '\\n';
        break;
      case '\r':
        out += '\\r';
        break;
      case '\t':
        out += '\\t';
        break;
      default:
        if (code < 0x20) {
          out += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          out += ch;
        }
    }
  }
  return out + '"';
}

export function canonicalize(payload: Record<string, unknown>): string {
  return encode(payload);
}
