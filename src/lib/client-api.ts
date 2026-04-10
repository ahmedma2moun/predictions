import { toast } from 'sonner';

/**
 * Reads the JSON error body from a failed Response and shows a toast.
 * Call this after a `!r.ok` check instead of copy-pasting the same
 * `const err = await r.json(); toast.error(...)` pattern everywhere.
 */
export async function toastApiError(r: Response, fallback = 'Something went wrong'): Promise<void> {
  try {
    const err = await r.json();
    toast.error((err as { error?: string }).error || fallback);
  } catch {
    toast.error(fallback);
  }
}
