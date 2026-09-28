// Auth khusus aplikasi native (Capacitor) memakai token native `tm_...`
// yang disimpan di localStorage — bukan cookie sesi, karena cookie
// SameSite=Lax tidak ikut terkirim lintas-situs dari WebView.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api-base";

export interface NativeUser {
  id: number;
  email: string;
  role: string;
  emailVerified: boolean;
}

interface NativeAuthValue {
  user: NativeUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = "tm_native_token";

const NativeAuthContext = createContext<NativeAuthValue | null>(null);

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (data?.message as string) || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function NativeAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NativeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Saat mount: validasi token yang tersimpan, bila ada.
  useEffect(() => {
    const token = readToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setUser(data as NativeUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/native-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    if (!data?.token) throw new Error("Token tidak diterima dari server.");
    try {
      window.localStorage.setItem(TOKEN_KEY, data.token);
    } catch {
      /* abaikan */
    }
    setUser(data.user as NativeUser);
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      // Register backend memakai cookie sesi (tidak persisten di WebView),
      // jadi langsung tukar kredensial menjadi native token.
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    const token = readToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/native-token`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* abaikan */
      }
      try {
        window.localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* abaikan */
      }
    }
    setUser(null);
  }, []);

  return (
    <NativeAuthContext.Provider
      value={{ user, isLoading, login, register, logout }}
    >
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useNativeAuth(): NativeAuthValue {
  const ctx = useContext(NativeAuthContext);
  if (!ctx)
    throw new Error("useNativeAuth harus dipakai di dalam NativeAuthProvider");
  return ctx;
}
