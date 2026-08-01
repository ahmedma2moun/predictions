export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${field} is required`);
  return value.trim();
}

export function requireDate(value: unknown, field: string): Date {
  const d = typeof value === 'string' || typeof value === 'number' || value instanceof Date ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) throw new ValidationError(`${field} must be a valid date`);
  return d;
}

export function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}
