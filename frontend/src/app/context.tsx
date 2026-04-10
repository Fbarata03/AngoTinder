import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, User, setToken, getToken, clearToken, RegisterData } from "./api";

interface AppContextType {
  currentUser: User | null;
  userId: string;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  loginWithToken: (token: string, user: User) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!userId && !!currentUser;

  // Restore session from stored token
  useEffect(() => {
    const token = getToken();
    if (token) {
      authApi
        .getMe()
        .then((user) => {
          setCurrentUser(user);
          setUserId(user.id);
        })
        .catch(() => {
          clearToken();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Keep-alive: ping backend every 10 min to prevent Render from sleeping
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (import.meta as any).env?.VITE_API_URL || "/api";
    const ping = () => fetch(`${base}/health`).catch(() => {});
    ping(); // ping imediato ao carregar
    const interval = setInterval(ping, 10 * 60 * 1000); // a cada 10 minutos
    return () => clearInterval(interval);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setCurrentUser(res.user);
    setUserId(res.user.id);
  };

  const register = async (data: RegisterData) => {
    const res = await authApi.register(data);
    setToken(res.token);
    setCurrentUser(res.user);
    setUserId(res.user.id);
  };

  const logout = () => {
    clearToken();
    setUserId("");
    setCurrentUser(null);
  };

  const updateUser = (user: User) => {
    setCurrentUser(user);
  };

  const loginWithToken = (token: string, user: User) => {
    setToken(token);
    setCurrentUser(user);
    setUserId(user.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#CE1126] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#FFCD00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ currentUser, userId, isLoggedIn, login, register, logout, updateUser, loginWithToken }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
