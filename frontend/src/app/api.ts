// API base URL - uses proxy in dev, env var in production
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL = (import.meta as any).env?.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
}

export interface LoginResponse {
  user_id: string;
  name: string;
  photos: string[];
  location: string;
}

export const authApi = {
  login: (provider: string, user_id = "user_me") =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ provider, user_id }),
    }),

  getMe: (userId: string) => request<User>(`/auth/me/${userId}`),
};

// ---------- Profiles ----------
export const profilesApi = {
  discover: (userId: string) =>
    request<User[]>(`/profiles/discover?user_id=${userId}`),

  getProfile: (profileId: string) =>
    request<User>(`/profiles/${profileId}`),

  updateProfile: (userId: string, data: Partial<User>) =>
    request<User>(`/profiles/me/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getLikes: (userId: string) =>
    request<User[]>(`/profiles/likes/${userId}`),

  getTopPicks: (userId: string) =>
    request<(User & { reason: string })[]>(`/profiles/top-picks/${userId}`),
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
  lastMessage?: string;
  unread?: boolean;
}

export interface SwipeResponse {
  is_match: boolean;
  match_id: string | null;
}

export const matchesApi = {
  swipe: (swiper_id: string, swiped_id: string, direction: "left" | "right" | "super") =>
    request<SwipeResponse>("/matches/swipe", {
      method: "POST",
      body: JSON.stringify({ swiper_id, swiped_id, direction }),
    }),

  getMatches: (userId: string) => request<Match[]>(`/matches/${userId}`),

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

  sendMessage: (matchId: string, sender_id: string, text: string) =>
    request<Message>(`/messages/${matchId}`, {
      method: "POST",
      body: JSON.stringify({ sender_id, text }),
    }),
};
