import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, User } from "./api";

interface AppContextType {
  currentUser: User | null;
  userId: string;
  isLoggedIn: boolean;
  login: (provider: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const USER_ID_KEY = "angotinder_user_id";

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem(USER_ID_KEY) || "";
  });

  const isLoggedIn = !!userId && !!currentUser;

  useEffect(() => {
    if (userId) {
      authApi
        .getMe(userId)
        .then((user) => setCurrentUser(user))
        .catch(() => {
          localStorage.removeItem(USER_ID_KEY);
          setUserId("");
        });
    }
  }, [userId]);

  const login = async (provider: string) => {
    const res = await authApi.login(provider);
    localStorage.setItem(USER_ID_KEY, res.user_id);
    setUserId(res.user_id);
    const user = await authApi.getMe(res.user_id);
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem(USER_ID_KEY);
    setUserId("");
    setCurrentUser(null);
  };

  const updateUser = (user: User) => {
    setCurrentUser(user);
  };

  return (
    <AppContext.Provider value={{ currentUser, userId, isLoggedIn, login, logout, updateUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
