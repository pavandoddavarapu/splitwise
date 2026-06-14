/**
 * AuthContext — provides authentication state and actions to the whole app.
 *
 * On mount:
 *   If a token exists in localStorage, hit GET /api/auth/me/ to verify it's
 *   still valid and re-hydrate the user object. This means a page refresh
 *   doesn't log the user out.
 *
 * Actions:
 *   login(email, password)        — POST /api/auth/login/, store token
 *   register(name, email, password) — POST /api/auth/register/, store token
 *   logout()                      — POST /api/auth/logout/, clear token
 *
 * The `loading` flag is true while the startup /me/ check is in flight.
 * Components that need auth state should wait for loading=false before
 * making routing decisions (prevents flash-of-redirect on page load).
 */

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app startup: verify any stored token is still valid.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me/")
      .then(setUser)
      .catch(() => {
        // Token invalid or expired — clean up so user sees the login page.
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login/", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password) {
    const data = await api.post("/auth/register/", { name, email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await api.post("/auth/logout/");
    } catch (_) {
      // If the server is unreachable we still want to clear local state.
    }
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
