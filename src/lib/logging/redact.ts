export const MAX_BODY_BYTES = 16 * 1024;

const SENSITIVE_KEYS = new Set([
  'password', 'currentpassword', 'newpassword', 'token', 'accesstoken',
  'refreshtoken', 'fcmtoken', 'secret', 'authorization',
]);

const REDACTED = '[REDACTED]';

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactValue(v)]),
    );
  }
  return value;
}

function redactForm(text: string): string {
  return text
    .split('&')
    .map(pair => {
      const [key] = pair.split('=');
      return SENSITIVE_KEYS.has(decodeURIComponent(key ?? '').toLowerCase()) ? `${key}=${REDACTED}` : pair;
    })
    .join('&');
}

export interface SanitizedBody {
  text: string;
  truncated: boolean;
  items?: number;
}

/** Redacts sensitive keys, then caps the body at 16 KB. Bodies are returned as strings, never objects. */
export function sanitizeBody(raw: string): SanitizedBody {
  if (!raw) return { text: '', truncated: false };

  let text = raw;
  let items: number | undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) items = parsed.length;
    text = JSON.stringify(redactValue(parsed));
  } catch {
    // Not JSON — handle urlencoded form bodies (key=value&...), leave anything else untouched.
    if (/^[^\s=&]+=[^\s]*$/.test(raw)) {
      try { text = redactForm(raw); } catch { text = REDACTED; }
    }
  }

  if (text.length <= MAX_BODY_BYTES) return { text, truncated: false };
  return { text: text.slice(0, MAX_BODY_BYTES), truncated: true, ...(items !== undefined && { items }) };
}
