import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    apiBaseUrl?: string;
    apiBaseUrlDev?: string;
  };
  if (__DEV__) {
    if (Platform.OS === 'android') return extra.apiBaseUrlDev ?? 'http://10.0.2.2:3000';
    return extra.apiBaseUrlDev?.replace('10.0.2.2', 'localhost') ?? 'http://localhost:3000';
  }
  return extra.apiBaseUrl ?? 'https://predictions-virid.vercel.app';
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
