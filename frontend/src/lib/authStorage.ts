import type { AuthSession } from '@/api/types';

const PERSISTENT_AUTH_KEY = 'jellyfin-miner.auth.persistent';
const SESSION_AUTH_KEY = 'jellyfin-miner.auth.session';

export function loadStoredAuth(): AuthSession | null {
  return readAuth(localStorage, PERSISTENT_AUTH_KEY) ?? readAuth(sessionStorage, SESSION_AUTH_KEY);
}

export function saveStoredAuth(auth: AuthSession, remember: boolean): void {
  clearStoredAuth();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(remember ? PERSISTENT_AUTH_KEY : SESSION_AUTH_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(PERSISTENT_AUTH_KEY);
  sessionStorage.removeItem(SESSION_AUTH_KEY);
}

function readAuth(storage: Storage, key: string): AuthSession | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAuthSession(parsed)) {
      return parsed;
    }
  } catch {
    storage.removeItem(key);
  }

  return null;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.deviceId === 'string' &&
    typeof candidate.savedAt === 'string'
  );
}
