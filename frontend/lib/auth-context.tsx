"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiGetMe, apiLogin, apiLogout, apiSignup, AuthUser, clearStoredToken, getStoredToken } from "./api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<AuthUser>;
  signup: (email: string, pass: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => { throw new Error("AuthProvider missing"); },
  signup: async () => { throw new Error("AuthProvider missing"); },
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = getStoredToken();
    try {
      const u = await apiGetMe();
      setUser(u);
    } catch {
      // If unauthorized, clear stored token and reset user
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const u = await apiLogin(email, pass);
    setUser(u);
    return u;
  };

  const signup = async (email: string, pass: string) => {
    const u = await apiSignup(email, pass);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
