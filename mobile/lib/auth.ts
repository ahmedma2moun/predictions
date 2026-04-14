import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fp_mobile_jwt';
const USER_KEY  = 'fp_mobile_user';

// expo-secure-store is native-only; fall back to localStorage on web
async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function storeSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
async function storeDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

// ── Auth-cleared listeners ─────────────────────────────────────────────────────
// Called whenever clearAuth() runs (e.g. on 401). Root layout subscribes so it
// can redirect to /login without polling SecureStore.

type Listener = () => void;
const authClearedListeners: Listener[] = [];

/** Register a callback that fires when credentials are cleared. Returns unsubscribe fn. */
export function onAuthCleared(listener: Listener): () => void {
  authClearedListeners.push(listener);
  return () => {
    const i = authClearedListeners.indexOf(listener);
    if (i !== -1) authClearedListeners.splice(i, 1);
  };
}

export type User = {
  id:    string;
  name:  string;
  email: string;
  role:  string;
};

// ── Token helpers ──────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return storeGet(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await storeSet(TOKEN_KEY, token);
}

// ── User helpers ───────────────────────────────────────────────────────────────

export async function getUser(): Promise<User | null> {
  const raw = await storeGet(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export async function saveUser(user: User): Promise<void> {
  await storeSet(USER_KEY, JSON.stringify(user));
}

// ── Auth actions ───────────────────────────────────────────────────────────────

export async function clearAuth(): Promise<void> {
  await Promise.all([
    storeDelete(TOKEN_KEY),
    storeDelete(USER_KEY),
  ]);
  authClearedListeners.forEach((fn) => fn());
}
