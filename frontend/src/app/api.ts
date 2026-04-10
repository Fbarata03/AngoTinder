// API base URL - uses env var, then proxy in dev, then Render backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL = (import.meta as any).env?.VITE_API_URL || "/api";

const TOKEN_KEY = "angotinder_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Auth ----------
export interface User {
  id: string;
  name: string;
  age: number;
  location: string;
  work: string;
  bio: string;
  photos: string[];
  is_verified: number;
  education?: string;
  hometown?: string;
  interests: string[];
  gender?: string;
  looking_for?: string;
  email?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  age: number;
  location: string;
  gender?: string;
  looking_for?: string;
  bio?: string;
  work?: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<User>("/auth/me"),

  changePassword: (current_password: string, new_password: string) =>
    request<{ success: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
};

// ---------- Profiles ----------
export const profilesApi = {
  discover: () => request<User[]>("/profiles/discover"),

  getProfile: (profileId: string) => request<User>(`/profiles/${profileId}`),

  updateProfile: (data: Partial<User>) =>
    request<User>("/profiles/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  uploadPhoto: (file: File) =>
    upload<{ photo_url: string; photos: string[] }>("/profiles/me/photos", file),

  deletePhoto: (photo_url: string) =>
    request<{ photos: string[] }>(`/profiles/me/photos?photo_url=${encodeURIComponent(photo_url)}`, {
      method: "DELETE",
    }),

  getLikes: () => request<User[]>("/profiles/likes/received"),

  getTopPicks: () => request<(User & { reason: string })[]>("/profiles/top-picks/today"),
};

// ---------- Matches ----------
export interface Match {
  match_id: string;
  matched_at: string;
  id: string;
  name: string;
  age: number;
  location: string;
  photos: string[];
  last_message?: string;
  last_message_at?: string;
}

export interface SwipeResponse {
  is_match: boolean;
  match_id: string | null;
}

export const matchesApi = {
  swipe: (swiped_id: string, direction: "left" | "right" | "super") =>
    request<SwipeResponse>("/matches/swipe", {
      method: "POST",
      body: JSON.stringify({ swiped_id, direction }),
    }),

  getMatches: () => request<Match[]>("/matches/"),

  unmatch: (matchId: string) =>
    request(`/matches/${matchId}`, { method: "DELETE" }),
};

// ---------- Messages ----------
export interface Message {
  id: number;
  match_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  sender_name?: string;
}

export const messagesApi = {
  getMessages: (matchId: string) =>
    request<Message[]>(`/messages/${matchId}`),

  sendMessage: (matchId: string, text: string) =>
    request<Message>(`/messages/${matchId}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// ---------- WebSocket ----------
export function createChatSocket(matchId: string): WebSocket {
  const token = getToken() || "";
  let wsBase: string;
  if (BASE_URL.startsWith("http")) {
    // Production: https://angotinder.onrender.com/api → wss://angotinder.onrender.com
    wsBase = BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  } else {
    // Local dev: use current host with ws/wss
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    wsBase = `${proto}://${window.location.host}`;
  }
  return new WebSocket(`${wsBase}/api/messages/ws/${matchId}?token=${token}`);
}
