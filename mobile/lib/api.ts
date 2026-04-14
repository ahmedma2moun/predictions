import axios from 'axios';
import { API_BASE_URL } from './constants';
import { getToken, clearAuth } from './auth';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored credentials so the root layout redirects to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAuth();
      // The root layout listens for auth state; it will redirect to /login
    }
    return Promise.reject(error);
  },
);

// ── Shared API helpers ─────────────────────────────────────────────────────────

export async function loginRequest(email: string, password: string) {
  const res = await axios.post(`${API_BASE_URL}/api/mobile/auth/login`, { email, password });
  return res.data as { token: string; user: { id: string; name: string; email: string; role: string } };
}
