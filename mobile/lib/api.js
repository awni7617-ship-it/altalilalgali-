/* ==================================================================
   Talking to the Cloudflare shop, and remembering who is signed in.

   The session token is kept in the device keychain rather than in a
   cookie: cookie handling on a native client is unreliable, and the
   keychain is the right place for a credential on a phone.
   ================================================================== */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { tr } from './i18n';

const TOKEN_KEY = 'altalil_session';

/**
 * Where the shop lives.
 *
 * Set it once in app.json → extra.apiUrl. EXPO_PUBLIC_API_URL wins
 * when it is present, which is how you point the app at a shop running
 * on your own machine while testing.
 */
export const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://altalil-shop.pages.dev',
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let memoryToken = null;

async function readToken() {
  if (memoryToken !== null) return memoryToken;
  try {
    memoryToken = (await SecureStore.getItemAsync(TOKEN_KEY)) || '';
  } catch {
    memoryToken = '';
  }
  return memoryToken;
}

async function writeToken(token) {
  memoryToken = token || '';
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* The keychain can refuse; the session still works for this run. */
  }
}

async function request(method, path, body) {
  const token = await readToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        /* Stands in for the browser Origin check on a native client. */
        'X-Shop-Request': '1',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    /* Which address failed is the whole diagnosis: a LAN address means
     * the shop on the computer is not answering, and the published one
     * means the app never found a shop to talk to. Saying only "check
     * your connection" hides the one fact that settles it. */
    throw new ApiError(tr('err_network_at', { url: API_URL }), 0, 'network');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new ApiError(tr('err_generic'), response.status, 'bad_response');
  }
  if (!response.ok || data.ok === false) {
    throw new ApiError(data.error || tr('err_generic'), response.status, data.code || '');
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: (p) => request('DELETE', p),
};

/** Product photos come back as site-relative paths. */
export const photoUrl = (url) => {
  const v = String(url || '');
  if (!v) return null;
  return v.startsWith('/') ? `${API_URL}${v}` : v;
};

/* ------------------------------------------------------------------ *
 * Who is signed in
 * ------------------------------------------------------------------ */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user: fresh } = await api.get('/api/auth/me');
      setUser(fresh);
      return fresh;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await readToken();
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const result = await api.post('/api/auth/login', { email, password });
    await writeToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (fields) => {
    const result = await api.post('/api/auth/register', fields);
    await writeToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* Sign out locally even if the shop cannot be reached. */
    }
    await writeToken('');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, register, signOut, refresh, setUser }),
    [user, ready, signIn, register, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
