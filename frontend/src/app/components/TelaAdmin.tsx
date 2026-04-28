import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Heart, MessageCircle, ShieldCheck, Trash2, CheckCircle, XCircle,
  LogOut, Search, TrendingUp, UserCheck, Activity, Zap, ArrowLeftRight,
  RefreshCw, ChevronLeft, ChevronRight, X, Eye, MapPin, Clock,
  Megaphone, Send, Percent, BarChart2,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
const DEFAULT_PROD_API = "https://angotinder.onrender.com/api";
const BASE_URL = (() => {
  if (ENV_API) return ENV_API;
  if (typeof window === "undefined") return "/api";
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? "/api" : DEFAULT_PROD_API;
})();
const HTTP_BASE = BASE_URL.startsWith("http") ? BASE_URL.replace(/\/api\/?$/, "") : "";

function resolvePhoto(url: string): string {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  if (HTTP_BASE && url.startsWith("/static/")) return `${HTTP_BASE}${url}`;
  return url;
}

function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("admin_token");
  return fetch(`${BASE_URL}/admin${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
    ...options,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.text();
      // Only throw auth-specific error object so callers can detect 401/403
      if (res.status === 401 || res.status === 403) {
        const e = new Error(err || `HTTP ${res.status}`);
        (e as any).status = res.status;
        throw e;
      }
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  });
}

interface Stats {
  total_users: number;
  verified_users: number;
  total_matches: number;
  total_messages: number;
  total_swipes: number;
  right_swipes: number;
  right_swipe_rate: number;
  match_rate: number;
  users_today: number;
  matches_today: number;
  messages_today: number;
  swipes_today: number;
  active_users_24h: number;
  online_users: number;
  top_locations: { location: string; count: number }[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  age: number;
  location: string;
  gender: string;
  is_verified: number;
  photos: string[];
  created_at: string;
  match_count?: number;
  message_count?: number;
}

interface AdminUserDetail extends AdminUser {
  bio: string;
  work: string;
  education?: string;
  hometown?: string;
  interests: string[];
  swipe_count: number;
  is_online: boolean;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

interface MatchRow {
  id: string;
  created_at: string;
  user1_name: string;
  user1_email: string;
  user1_photos: string[];
  user2_name: string;
  user2_email: string;
  user2_photos: string[];
  message_count: number;
}

interface MatchesResponse {
  matches: MatchRow[];
  total: number;
  page: number;
  pages: number;
}

interface ActivityEvent {
  type: "register" | "match" | "message";
  name: string;
  email: string;
  ts: string;
}

type Tab = "dashboard" | "users" | "matches" | "activity";

const ANGOLA_PROVINCES = [
  "Luanda", "Benguela", "Huambo", "Bié", "Malanje", "Huíla", "Cunene",
  "Cuando Cubango", "Moxico", "Lunda Norte", "Lunda Sul", "Uíge",
  "Cuanza Norte", "Cuanza Sul", "Bengo", "Zaire", "Cabinda", "Namibe",
];

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export function TelaAdmin() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("admin_token"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Users tab
  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Matches tab
  const [matchesData, setMatchesData] = useState<MatchesResponse | null>(null);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Activity tab
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Broadcast
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleAuthError = useCallback((err: unknown) => {
    if (err && typeof err === "object" && (err as any).status === 401) {
      localStorage.removeItem("admin_token");
      setLoggedIn(false);
    }
  }, []);

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    try {
      const data = await adminRequest<Stats>("/stats");
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      handleAuthError(err);
    } finally {
      setStatsLoading(false);
    }
  }, [handleAuthError]);

  const loadUsers = useCallback(async (p = 1) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set("search", search);
      if (filterGender) params.set("gender", filterGender);
      if (filterVerified) params.set("verified", filterVerified);
      if (filterLocation) params.set("location", filterLocation);
      const data = await adminRequest<UsersResponse>(`/users?${params}`);
      setUsersData(data);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setUsersLoading(false);
    }
  }, [search, filterGender, filterVerified, filterLocation, handleAuthError]);

  const loadMatches = useCallback(async (p = 1) => {
    setMatchesLoading(true);
    try {
      const data = await adminRequest<MatchesResponse>(`/matches?page=${p}`);
      setMatchesData(data);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setMatchesLoading(false);
    }
  }, [handleAuthError]);

  const loadActivity = useCallback(async (silent = false) => {
    if (!silent) setActivityLoading(true);
    try {
      const data = await adminRequest<ActivityEvent[]>("/activity");
      setActivity(data);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setActivityLoading(false);
    }
  }, [handleAuthError]);

  const loadUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const data = await adminRequest<AdminUserDetail>(`/users/${userId}`);
      setSelectedUser(data);
    } catch { /* ignore */ } finally {
      setUserDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadStats();
    refreshTimerRef.current = setInterval(() => loadStats(true), 30000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [loggedIn, loadStats]);

  useEffect(() => {
    if (!loggedIn) return;
    if (activeTab === "users") loadUsers(1);
    if (activeTab === "matches") loadMatches(1);
    if (activeTab === "activity") {
      loadActivity();
      activityTimerRef.current = setInterval(() => loadActivity(true), 20000);
    }
    return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current); };
  }, [activeTab, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await adminRequest<{ token: string }>("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("admin_token", res.token);
      setLoggedIn(true);
    } catch {
      setLoginError("Credenciais inválidas");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify = async (userId: string, verify: boolean) => {
    setActionLoading(userId);
    try {
      await adminRequest(`/users/${userId}/${verify ? "verify" : "unverify"}`, { method: "POST" });
      showSuccess(verify ? "Utilizador verificado!" : "Verificação removida!");
      loadUsers(usersPage);
      loadStats(true);
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_verified: verify ? 1 : 0 } : null);
      }
    } catch { alert("Erro ao atualizar"); } finally { setActionLoading(null); }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Tens a certeza que queres eliminar "${name}"? Esta ação é irreversível.`)) return;
    setActionLoading(userId);
    try {
      await adminRequest(`/users/${userId}`, { method: "DELETE" });
      showSuccess("Utilizador eliminado!");
      setSelectedUser(null);
      loadUsers(usersPage);
      loadStats(true);
    } catch { alert("Erro ao eliminar"); } finally { setActionLoading(null); }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm("Eliminar este match e todas as suas mensagens?")) return;
    setActionLoading(matchId);
    try {
      await adminRequest(`/matches/${matchId}`, { method: "DELETE" });
      showSuccess("Match eliminado!");
      loadMatches(matchesPage);
      loadStats(true);
    } catch { alert("Erro ao eliminar match"); } finally { setActionLoading(null); }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;
    setBroadcastLoading(true);
    try {
      await adminRequest("/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: broadcastTitle, message: broadcastMsg }),
      });
      showSuccess(`Notificação enviada a ${stats?.online_users ?? 0} utilizadores online!`);
      setBroadcastTitle("");
      setBroadcastMsg("");
      setShowBroadcast(false);
    } catch { alert("Erro ao enviar notificação"); } finally { setBroadcastLoading(false); }
  };

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      await adminRequest("/cleanup", { method: "POST" });
      showSuccess("Limpeza concluída! Base de dados otimizada.");
      loadStats(true);
    } catch { alert("Erro na limpeza"); } finally { setCleanupLoading(false); }
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUsersPage(1);
    loadUsers(1);
  };

  const handleLogout = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    localStorage.removeItem("admin_token");
    setLoggedIn(false);
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex items-center justify-center p-4">
        <div className="bg-black border-2 border-[#FFCD00] rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#FFCD00] rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-black text-[#FFCD00]">Painel Admin</h1>
            <p className="text-white/50 text-sm mt-1">AngoTinder</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="Utilizador" autoComplete="username"
              className="w-full h-12 px-4 bg-white/10 border border-[#FFCD00]/30 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFCD00] text-sm"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha" autoComplete="current-password"
              className="w-full h-12 px-4 bg-white/10 border border-[#FFCD00]/30 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFCD00] text-sm"
            />
            {loginError && <p className="text-red-400 text-sm text-center font-medium">{loginError}</p>}
            <button
              type="submit" disabled={loginLoading}
              className="w-full h-12 bg-[#FFCD00] hover:bg-[#FFD700] text-black font-black rounded-xl transition-colors disabled:opacity-60"
            >
              {loginLoading ? "A entrar..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main panel ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Utilizadores", count: usersData?.total },
    { id: "matches", label: "Matches", count: matchesData?.total },
    { id: "activity", label: "Atividade" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-black border-b border-[#FFCD00]/20 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#FFCD00] rounded-full flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#FFCD00] leading-none">AngoTinder Admin</h1>
            {stats && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-bold">{stats.online_users} online</span>
                {lastRefresh && (
                  <span className="text-white/30 text-xs hidden sm:inline">· {timeAgo(lastRefresh.toISOString())}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowBroadcast(true)}
            title="Enviar notificação a todos"
            className="flex items-center gap-1.5 h-8 px-3 bg-[#FFCD00]/10 hover:bg-[#FFCD00]/20 text-[#FFCD00] rounded-lg text-xs font-bold transition-colors border border-[#FFCD00]/20"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>
          <button
            onClick={() => loadStats()}
            disabled={statsLoading}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors px-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Sair</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-[#FFCD00] text-[#FFCD00]"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-white/10 text-white/50 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {successMsg && (
          <div className="mb-4 bg-green-900/40 border border-green-500/50 text-green-300 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div>
            {stats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                  <StatCard icon={<Users />} label="Total Utilizadores" value={stats.total_users} color="blue" />
                  <StatCard icon={<Zap />} label="Online Agora" value={stats.online_users} color="green" live />
                  <StatCard icon={<TrendingUp />} label="Novos Hoje" value={stats.users_today} color="cyan" />
                  <StatCard icon={<UserCheck />} label="Verificados" value={stats.verified_users} color="yellow" />
                  <StatCard icon={<Heart />} label="Total Matches" value={stats.total_matches} color="red" />
                  <StatCard icon={<Heart />} label="Matches Hoje" value={stats.matches_today} color="pink" />
                  <StatCard icon={<MessageCircle />} label="Msgs Hoje" value={stats.messages_today} color="purple" />
                  <StatCard icon={<MessageCircle />} label="Total Msgs" value={stats.total_messages} color="indigo" />
                  <StatCard icon={<ArrowLeftRight />} label="Swipes Hoje" value={stats.swipes_today} color="orange" />
                  <StatCard icon={<ArrowLeftRight />} label="Total Swipes" value={stats.total_swipes} color="amber" />
                  <StatCard icon={<Activity />} label="Ativos 24h" value={stats.active_users_24h} color="teal" />
                </div>

                {/* Rates */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Percent className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white">{stats.right_swipe_rate}%</div>
                      <div className="text-xs text-white/40">Taxa de likes (right swipes)</div>
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <BarChart2 className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white">{stats.match_rate}%</div>
                      <div className="text-xs text-white/40">Taxa de match (de likes mútuos)</div>
                    </div>
                  </div>
                </div>

                {/* Top locations */}
                {stats.top_locations.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
                    <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-[#FFCD00]" /> Top Províncias
                    </h3>
                    <div className="space-y-2.5">
                      {stats.top_locations.map((loc) => {
                        const max = stats.top_locations[0]?.count || 1;
                        const pct = Math.round((loc.count / max) * 100);
                        return (
                          <div key={loc.location}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/70">{loc.location || "Desconhecido"}</span>
                              <span className="text-white/40">{loc.count} utilizadores</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#CE1126] to-[#FFCD00] rounded-full transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* System + cleanup */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-black text-white mb-3 text-sm">Estado do Sistema</h3>
                  <div className="space-y-2 text-sm mb-4">
                    {[
                      ["Base de dados", "PostgreSQL (Neon)"],
                      ["Backend", "Render.com"],
                      ["Frontend", "Netlify"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-white/50">{k}</span>
                        <span className="text-green-400 font-bold text-xs">{v} ✓</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/30 text-xs mb-3">
                    Remove OTPs expirados, swipes antigos (+60 dias) e mensagens excedentes.
                  </p>
                  <button
                    onClick={handleCleanup}
                    disabled={cleanupLoading}
                    className="w-full h-10 bg-[#FFCD00]/10 hover:bg-[#FFCD00]/20 border border-[#FFCD00]/30 text-[#FFCD00] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {cleanupLoading ? "A limpar..." : "🧹 Limpar Base de Dados"}
                  </button>
                </div>
              </>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === "users" && (
          <div>
            <form onSubmit={handleUserSearch} className="mb-4 space-y-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar nome ou email..."
                    className="w-full pl-9 pr-4 h-10 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#FFCD00]"
                  />
                </div>
                <button type="submit" className="h-10 px-4 bg-[#FFCD00] text-black font-bold rounded-xl text-sm hover:bg-[#FFD700] transition-colors flex-shrink-0">
                  Buscar
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
                  className="h-9 px-3 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFCD00]"
                >
                  <option value="">Todos os géneros</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
                <select
                  value={filterVerified} onChange={(e) => setFilterVerified(e.target.value)}
                  className="h-9 px-3 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFCD00]"
                >
                  <option value="">Todos</option>
                  <option value="yes">Verificados</option>
                  <option value="no">Não verificados</option>
                </select>
                <select
                  value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}
                  className="h-9 px-3 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFCD00]"
                >
                  <option value="">Todas as províncias</option>
                  {ANGOLA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {(filterGender || filterVerified || filterLocation) && (
                  <button
                    type="button"
                    onClick={() => { setFilterGender(""); setFilterVerified(""); setFilterLocation(""); }}
                    className="h-9 px-3 bg-white/10 border border-white/20 rounded-lg text-white/60 text-xs hover:text-white transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>
            </form>

            {usersLoading ? <LoadingSpinner /> : (
              <>
                <p className="text-white/40 text-xs mb-3">
                  {usersData?.total ?? 0} utilizadores · pág. {usersPage}/{usersData?.pages ?? 1}
                </p>
                <div className="space-y-2">
                  {usersData?.users.map((user) => (
                    <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3 hover:border-white/20 transition-colors">
                      <div
                        className="w-11 h-11 rounded-full overflow-hidden bg-white/10 flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-[#FFCD00]/50 transition-all"
                        onClick={() => loadUserDetail(user.id)}
                      >
                        {user.photos?.[0] ? (
                          <img src={resolvePhoto(user.photos[0])} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 text-lg font-black bg-gradient-to-br from-[#CE1126]/40 to-black">
                            {user.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">{user.name}</span>
                          {user.is_verified === 1 && (
                            <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full font-black">VIP</span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-white/25 text-xs">{user.age}a · {user.location}</span>
                          {user.match_count !== undefined && (
                            <span className="text-rose-400/60 text-xs">{user.match_count}♥</span>
                          )}
                          {user.message_count !== undefined && (
                            <span className="text-purple-400/60 text-xs">{user.message_count} msgs</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => loadUserDetail(user.id)} title="Ver detalhes"
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg flex items-center justify-center transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {user.is_verified === 1 ? (
                          <button onClick={() => handleVerify(user.id, false)} disabled={actionLoading === user.id} title="Remover verificação"
                            className="w-8 h-8 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleVerify(user.id, true)} disabled={actionLoading === user.id} title="Verificar"
                            className="w-8 h-8 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(user.id, user.name)} disabled={actionLoading === user.id} title="Eliminar"
                          className="w-8 h-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {usersData?.users.length === 0 && (
                    <p className="text-center text-white/30 py-12 text-sm">Nenhum utilizador encontrado.</p>
                  )}
                </div>
                {usersData && usersData.pages > 1 && (
                  <Pagination
                    page={usersPage} pages={usersData.pages}
                    onPrev={() => { const p = usersPage - 1; setUsersPage(p); loadUsers(p); }}
                    onNext={() => { const p = usersPage + 1; setUsersPage(p); loadUsers(p); }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── MATCHES ── */}
        {activeTab === "matches" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white">
                Matches <span className="text-white/30 font-normal">({matchesData?.total ?? 0})</span>
              </h2>
              <button onClick={() => loadMatches(matchesPage)} disabled={matchesLoading}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${matchesLoading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>
            {matchesLoading ? <LoadingSpinner /> : (
              <>
                <div className="space-y-2">
                  {matchesData?.matches.map((m) => (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3 hover:border-white/20 transition-colors">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {m.user1_photos?.[0] ? (
                          <img src={resolvePhoto(m.user1_photos[0])} alt={m.user1_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-black">{m.user1_name[0]}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">
                          {m.user1_name} <span className="text-[#FFCD00]">↔</span> {m.user2_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/30 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />{timeAgo(m.created_at)}
                          </span>
                          <span className="text-purple-400/70 text-xs">{m.message_count} msgs</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {m.user2_photos?.[0] ? (
                          <img src={resolvePhoto(m.user2_photos[0])} alt={m.user2_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-black">{m.user2_name[0]}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMatch(m.id)}
                        disabled={actionLoading === m.id}
                        title="Eliminar match"
                        className="w-8 h-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {matchesData?.matches.length === 0 && (
                    <p className="text-center text-white/30 py-12 text-sm">Nenhum match ainda.</p>
                  )}
                </div>
                {matchesData && matchesData.pages > 1 && (
                  <Pagination
                    page={matchesPage} pages={matchesData.pages}
                    onPrev={() => { const p = matchesPage - 1; setMatchesPage(p); loadMatches(p); }}
                    onNext={() => { const p = matchesPage + 1; setMatchesPage(p); loadMatches(p); }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === "activity" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-white">Atividade Recente</h2>
                <p className="text-white/30 text-xs mt-0.5">Auto-atualiza de 20 em 20 segundos</p>
              </div>
              <button onClick={() => loadActivity()} disabled={activityLoading}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>
            {activityLoading && activity.length === 0 ? <LoadingSpinner /> : (
              <div className="space-y-2">
                {activity.map((ev, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:border-white/20 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ev.type === "register" ? "bg-blue-500/20 text-blue-400"
                      : ev.type === "match" ? "bg-rose-500/20 text-rose-400"
                      : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {ev.type === "register" ? <Users className="w-4 h-4" />
                        : ev.type === "match" ? <Heart className="w-4 h-4" />
                        : <MessageCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{ev.name}</p>
                      {ev.email && <p className="text-white/30 text-xs truncate">{ev.email}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        ev.type === "register" ? "bg-blue-500/20 text-blue-300"
                        : ev.type === "match" ? "bg-rose-500/20 text-rose-300"
                        : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {ev.type === "register" ? "Registo" : ev.type === "match" ? "Match" : "Mensagem"}
                      </span>
                      <p className="text-white/25 text-[10px] mt-1">{timeAgo(ev.ts)}</p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && !activityLoading && (
                  <p className="text-center text-white/30 py-12 text-sm">Nenhuma atividade recente.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── User Detail Modal ── */}
      {(userDetailLoading || selectedUser) && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
          <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            {userDetailLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner /></div>
            ) : selectedUser && (
              <>
                <div className="relative">
                  <div className="h-28 bg-gradient-to-br from-[#CE1126]/50 to-black rounded-t-2xl" />
                  <div className="absolute bottom-0 left-4 translate-y-1/2">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-900 bg-white/10">
                      {selectedUser.photos?.[0] ? (
                        <img src={resolvePhoto(selectedUser.photos[0])} alt={selectedUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/40">
                          {selectedUser.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white/60 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 pt-12 pb-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-white">{selectedUser.name}</h3>
                      <p className="text-white/40 text-sm">{selectedUser.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                      {selectedUser.is_online && (
                        <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Online
                        </span>
                      )}
                      {selectedUser.is_verified === 1 && (
                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold">✓ VIP</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Matches", value: selectedUser.match_count ?? 0, color: "text-rose-400" },
                      { label: "Mensagens", value: selectedUser.message_count ?? 0, color: "text-purple-400" },
                      { label: "Swipes", value: selectedUser.swipe_count ?? 0, color: "text-orange-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-white/30 text-xs">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
                    <InfoRow label="Idade" value={`${selectedUser.age} anos`} />
                    <InfoRow label="Localização" value={selectedUser.location} />
                    <InfoRow label="Género" value={selectedUser.gender} />
                    {selectedUser.work && <InfoRow label="Trabalho" value={selectedUser.work} />}
                    {selectedUser.education && <InfoRow label="Educação" value={selectedUser.education} />}
                    {selectedUser.hometown && <InfoRow label="Cidade natal" value={selectedUser.hometown} />}
                    {selectedUser.bio && <InfoRow label="Bio" value={selectedUser.bio} />}
                    {selectedUser.interests?.length > 0 && (
                      <InfoRow label="Interesses" value={selectedUser.interests.join(", ")} />
                    )}
                    <InfoRow label="Membro desde" value={selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("pt-PT") : "-"} />
                  </div>

                  {selectedUser.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedUser.photos.map((url, i) => (
                        <img key={i} src={resolvePhoto(url)} alt="" className="w-20 h-28 object-cover rounded-xl flex-shrink-0" />
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {selectedUser.is_verified === 1 ? (
                      <button onClick={() => handleVerify(selectedUser.id, false)} disabled={actionLoading === selectedUser.id}
                        className="flex-1 h-11 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                        Remover VIP
                      </button>
                    ) : (
                      <button onClick={() => handleVerify(selectedUser.id, true)} disabled={actionLoading === selectedUser.id}
                        className="flex-1 h-11 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                        ✓ Dar VIP
                      </button>
                    )}
                    <button onClick={() => handleDelete(selectedUser.id, selectedUser.name)} disabled={actionLoading === selectedUser.id}
                      className="flex-1 h-11 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                      Eliminar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Broadcast Modal ── */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBroadcast(false); }}>
          <div className="bg-gray-900 border border-[#FFCD00]/30 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#FFCD00]/15 rounded-lg flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-[#FFCD00]" />
                </div>
                <h3 className="font-black text-white">Enviar Notificação</h3>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/40 text-xs mb-4">
              Será enviado a <span className="text-[#FFCD00] font-bold">{stats?.online_users ?? 0} utilizadores online</span> neste momento.
            </p>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <input
                type="text" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Título (ex: Novidade AngoTinder!)"
                maxLength={60}
                className="w-full h-11 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#FFCD00]"
              />
              <textarea
                value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Mensagem para todos os utilizadores..."
                maxLength={200}
                rows={3}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#FFCD00] resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBroadcast(false)}
                  className="flex-1 h-11 bg-white/10 hover:bg-white/15 text-white/60 rounded-xl text-sm font-bold transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={broadcastLoading || !broadcastTitle.trim() || !broadcastMsg.trim()}
                  className="flex-1 h-11 bg-[#FFCD00] hover:bg-[#FFD700] text-black rounded-xl text-sm font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {broadcastLoading ? "A enviar..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-500/10   text-blue-400   border-blue-500/20",
  green:  "bg-green-500/10  text-green-400  border-green-500/20",
  cyan:   "bg-cyan-500/10   text-cyan-400   border-cyan-500/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  red:    "bg-red-500/10    text-red-400    border-red-500/20",
  pink:   "bg-pink-500/10   text-pink-400   border-pink-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  amber:  "bg-amber-500/10  text-amber-400  border-amber-500/20",
  teal:   "bg-teal-500/10   text-teal-400   border-teal-500/20",
};

function StatCard({ icon, label, value, color, live }: {
  icon: React.ReactNode; label: string; value: number; color: string; live?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-5 h-5 opacity-80">{icon}</div>
        {live && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse mt-0.5" />}
      </div>
      <div className="text-xl sm:text-2xl font-black text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-white/40 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function Pagination({ page, pages, onPrev, onNext }: {
  page: number; pages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex justify-center items-center gap-3 mt-6">
      <button onClick={onPrev} disabled={page <= 1}
        className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl disabled:opacity-30 hover:bg-white/20 transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-white/40">{page} / {pages}</span>
      <button onClick={onNext} disabled={page >= pages}
        className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl disabled:opacity-30 hover:bg-white/20 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-10 h-10 border-4 border-[#FFCD00] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/35 flex-shrink-0 w-24 text-xs">{label}</span>
      <span className="text-white/75 break-all text-xs">{value}</span>
    </div>
  );
}
