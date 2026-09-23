import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, object = admin
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("hl_token");
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("hl_token");
        setUser(false);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return data; // { requires_2fa, challenge, email }
  };

  const verify2fa = async (challenge, code) => {
    const { data } = await api.post("/auth/verify-2fa", { challenge, code });
    localStorage.setItem("hl_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const refresh = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch { /* keep current */ }
  };

  const logout = () => {
    localStorage.removeItem("hl_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, verify2fa, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
