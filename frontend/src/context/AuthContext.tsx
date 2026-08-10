import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearStoredTokens,
  getCurrentUser,
  getStoredToken,
  login as apiLogin,
  onSessionExpired,
  storeTokens,
} from "@/api/client";
import type { User } from "@/api/types";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      if (!getStoredToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await getCurrentUser();
        if (active) setUser(me);
      } catch {
        clearStoredTokens();
      } finally {
        if (active) setLoading(false);
      }
    };

    restore();

    // A failed token refresh anywhere in the app ends the session.
    const unsubscribe = onSessionExpired(() => {
      if (active) setUser(null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string) => {
    const tokens = await apiLogin(username, password);
    storeTokens(tokens);
    const me = await getCurrentUser();
    setUser(me);
  };

  const logout = () => {
    clearStoredTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
