// API base URL - uses env var, then proxy in dev, then Render backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_BASE_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;
const DEFAULT_PROD_API = "https://angotinder.onrender.com/api";
const BASE_URL = (() => {
  if (ENV_BASE_URL) return ENV_BASE_URL;
  if (typeof window === "undefined") return "/api";
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? "/api" : DEFAULT_PROD_API;
})();

const HTTP_BASE = BASE_URL.startsWith("http") ? BASE_URL.replace(/\/api\/?$/, "") : "";

export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  if (HTTP_BASE && url.startsWith("/static/")) return `${HTTP_BASE}${url}`;
  return url;
}

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
  latitude?: number | null;
  longitude?: number | null;
  last_active_at?: string;
  incognito_mode?: number;
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

  googleAuth: (access_token: string) =>
    request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ access_token }),
    }),

  facebookAuth: (access_token: string) =>
    request<AuthResponse>("/auth/facebook", {
      method: "POST",
      body: JSON.stringify({ access_token }),
    }),

  sendPhoneCode: (phone: string) =>
    request<{ success: boolean }>("/auth/phone/send", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyPhoneCode: (phone: string, code: string) =>
    request<AuthResponse>("/auth/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
};

// ---------- Profiles ----------
export const profilesApi = {
  discover: (params?: {
    min_age?: number;
    max_age?: number;
    gender?: string;
    verified_only?: boolean;
    lat?: number;
    lon?: number;
    max_distance_km?: number;
    prioritize_user_id?: string;
    online_only?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.min_age != null) q.set("min_age", String(params.min_age));
    if (params?.max_age != null) q.set("max_age", String(params.max_age));
    q.set("gender", params?.gender || "all");
    if (params?.verified_only) q.set("verified_only", "true");
    if (params?.lat != null) q.set("lat", String(params.lat));
    if (params?.lon != null) q.set("lon", String(params.lon));
    if (params?.max_distance_km != null) q.set("max_distance_km", String(params.max_distance_km));
    if (params?.prioritize_user_id) q.set("prioritize_user_id", params.prioritize_user_id);
    if (params?.online_only) q.set("online_only", "true");
    const qs = q.toString();
    return request<User[]>(`/profiles/discover${qs ? "?" + qs : ""}`);
  },

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

  resetSwipes: () => request<{ success: boolean }>("/profiles/me/swipes", { method: "DELETE" }),

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
  bio?: string;
  work?: string;
  education?: string;
  hometown?: string;
  interests?: string[];
  is_verified?: number;
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
  getMessages: (matchId: string, limit = 120, beforeId?: number) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (beforeId != null) q.set("before_id", String(beforeId));
    return request<Message[]>(`/messages/${matchId}?${q}`);
  },

  sendMessage: (matchId: string, text: string) =>
    request<Message>(`/messages/${matchId}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getTurnCredentials: () =>
    request<{ urls: string[]; username: string; credential: string; ttl: number }>("/messages/turn/credentials"),

  uploadMedia: (file: File, type: "image" | "audio" | "video" | "doc", ttlHours = 24) =>
    upload<{ url: string; text: string; filename?: string }>(`/messages/upload?type=${type}&ttl_hours=${ttlHours}`, file).then((r) => {
      const fixedUrl = resolveMediaUrl(r.url);
      if (type === "doc") {
        const filename = r.filename || file.name;
        return { url: fixedUrl, text: `doc:${fixedUrl}|${filename}`, filename };
      }
      const prefixes: Record<string, string> = { image: "img:", audio: "aud:", video: "vid:" };
      return { url: fixedUrl, text: `${prefixes[type]}${fixedUrl}`, filename: r.filename };
    }),
};

// ---------- WebSocket ----------
function getWsBase(): string {
  if (BASE_URL.startsWith("http")) {
    return BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export function createChatSocket(matchId: string): WebSocket {
  const token = getToken() || "";
  return new WebSocket(`${getWsBase()}/api/messages/ws/${matchId}?token=${token}`);
}

export function createNotificationSocket(): WebSocket {
  const token = getToken() || "";
  return new WebSocket(`${getWsBase()}/api/notifications/ws?token=${token}`);
}

export const notificationsApi = {
  getOnlineCount: () => request<{ count: number }>("/notifications/online-count"),
};

// ---------- Safety ----------
export const safetyApi = {
  block: (targetId: string) =>
    request<{ success: boolean }>(`/safety/block/${targetId}`, { method: "POST" }),

  unblock: (targetId: string) =>
    request<{ success: boolean }>(`/safety/block/${targetId}`, { method: "DELETE" }),

  getBlocked: () => request<{ id: string; name: string }[]>("/safety/blocks"),

  report: (reportedId: string, reason: string, details?: string) =>
    request<{ success: boolean; message: string }>("/safety/report", {
      method: "POST",
      body: JSON.stringify({ reported_id: reportedId, reason, details: details || "" }),
    }),
};
