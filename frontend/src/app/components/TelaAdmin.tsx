import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Heart, MessageCircle, ShieldCheck, Trash2, CheckCircle, XCircle,
  LogOut, Search, TrendingUp, UserCheck, Activity, Zap, ArrowLeftRight,
  RefreshCw, ChevronLeft, ChevronRight, X, Eye, MapPin, Clock,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL = (import.meta as any).env?.VITE_API_URL || "/api";

function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("admin_token");
  return fetch(`${BASE_URL}/admin${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.text();
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

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleAuthError = useCallback(() => {
    localStorage.removeItem("admin_token");
    setLoggedIn(false);
  }, []);

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    try {
      const data = await adminRequest<Stats>("/stats");
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      handleAuthError();
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
    } catch {
      handleAuthError();
    } finally {
      setUsersLoading(false);
    }
  }, [search, filterGender, filterVerified, filterLocation, handleAuthError]);

  const loadMatches = useCallback(async (p = 1) => {
    setMatchesLoading(true);
    try {
      const data = await adminRequest<MatchesResponse>(`/matches?page=${p}`);
      setMatchesData(data);
    } catch {
      handleAuthError();
    } finally {
      setMatchesLoading(false);
    }
  }, [handleAuthError]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await adminRequest<ActivityEvent[]>("/activity");
      setActivity(data);
    } catch {
      handleAuthError();
    } finally {
      setActivityLoading(false);
    }
  }, [handleAuthError]);

  const loadUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const data = await adminRequest<AdminUserDetail>(`/users/${userId}`);
      setSelectedUser(data);
    } catch {
      // ignore
    } finally {
      setUserDetailLoading(false);
    }
  };

  // Initial load + tab switching
  useEffect(() => {
    if (!loggedIn) return;
    loadStats();
    // Auto-refresh stats every 30s
    refreshTimerRef.current = setInterval(() => loadStats(true), 30000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [loggedIn, loadStats]);

  useEffect(() => {
    if (!loggedIn) return;
    if (activeTab === "users") loadUsers(1);
    if (activeTab === "matches") loadMatches(1);
    if (activeTab === "activity") loadActivity();
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
    } catch {
      alert("Erro ao atualizar");
    } finally {
      setActionLoading(null);
    }
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
    } catch {
      alert("Erro ao eliminar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      await adminRequest("/cleanup", { method: "POST" });
      showSuccess("Limpeza concluída! Base de dados otimizada.");
      loadStats(true);
    } catch {
      alert("Erro na limpeza");
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUsersPage(1);
    loadUsers(1);
  };

  const handleLogout = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    localStorage.removeItem("admin_token");
    setLoggedIn(false);
  };

  // ── Login screen ──────────────────────────────────────────────────────────
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
              placeholder="Utilizador"
              className="w-full h-12 px-4 bg-white/10 border border-[#FFCD00]/30 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFCD00] text-sm"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full h-12 px-4 bg-white/10 border border-[#FFCD00]/30 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFCD00] text-sm"
            />
            {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
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
  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Utilizadores" },
    { id: "matches", label: "Matches" },
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
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-bold">{stats.online_users} online</span>
                {lastRefresh && (
                  <span className="text-white/30 text-xs hidden sm:inline">· atualizado {timeAgo(lastRefresh.toISOString())}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadStats()}
            disabled={statsLoading}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
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
              className={`py-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#FFCD00] text-[#FFCD00]"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {successMsg && (
          <div className="mb-4 bg-green-900/50 border border-green-500 text-green-300 rounded-xl px-4 py-3 text-sm font-medium">
            {successMsg}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div>
            <h2 className="text-lg font-black text-white mb-4">Visão geral</h2>

            {stats ? (
              <>
                {/* Stat cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  <StatCard icon={<Users />} label="Total Utilizadores" value={stats.total_users} color="blue" />
                  <StatCard icon={<Zap />} label="Online Agora" value={stats.online_users} color="green" live />
                  <StatCard icon={<TrendingUp />} label="Novos Hoje" value={stats.users_today} color="cyan" />
                  <StatCard icon={<UserCheck />} label="Verificados" value={stats.verified_users} color="yellow" />
                  <StatCard icon={<Heart />} label="Total Matches" value={stats.total_matches} color="red" />
                  <StatCard icon={<Heart />} label="Matches Hoje" value={stats.matches_today} color="pink" />
                  <StatCard icon={<MessageCircle />} label="Mensagens Hoje" value={stats.messages_today} color="purple" />
                  <StatCard icon={<MessageCircle />} label="Total Mensagens" value={stats.total_messages} color="indigo" />
                  <StatCard icon={<ArrowLeftRight />} label="Swipes Hoje" value={stats.swipes_today} color="orange" />
                  <StatCard icon={<ArrowLeftRight />} label="Total Swipes" value={stats.total_swipes} color="amber" />
                  <StatCard icon={<Activity />} label="Ativos 24h" value={stats.active_users_24h} color="teal" />
                </div>

                {/* Top locations bar chart */}
                {stats.top_locations.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
                    <h3 className="font-black text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#FFCD00]" />
                      Top Localizações
                    </h3>
                    <div className="space-y-3">
                      {stats.top_locations.map((loc) => {
                        const max = stats.top_locations[0]?.count || 1;
                        const pct = Math.round((loc.count / max) * 100);
                        return (
                          <div key={loc.location}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-white/80">{loc.location || "Desconhecido"}</span>
                              <span className="text-white/50">{loc.count}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#CE1126] to-[#FFCD00] rounded-full transition-all duration-500"
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
                  <h3 className="font-black text-white mb-3">Estado do Sistema</h3>
                  <div className="space-y-2 text-sm">
                    {[
                      ["Base de dados", "PostgreSQL (Neon)"],
                      ["Backend", "Render.com"],
                      ["Frontend", "Netlify"],
                      ["Domínio", "angotinder.bafly.net"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-white/60">{k}</span>
                        <span className="text-green-400 font-bold">{v} ✓</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/40 text-xs mb-3">
                      Remove OTPs expirados, swipes antigos (+60 dias) e mensagens excedentes. Nunca apaga utilizadores.
                    </p>
                    <button
                      onClick={handleCleanup}
                      disabled={cleanupLoading}
                      className="w-full h-10 bg-[#FFCD00]/10 hover:bg-[#FFCD00]/20 border border-[#FFCD00]/30 text-[#FFCD00] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {cleanupLoading ? "A limpar..." : "🧹 Limpar Base de Dados"}
                    </button>
                  </div>
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
            {/* Search + filters */}
            <form onSubmit={handleUserSearch} className="mb-4 space-y-3">
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
                  Pesquisar
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
                    <X className="w-3 h-3" /> Limpar filtros
                  </button>
                )}
              </div>
            </form>

            {usersLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/40 text-sm">
                    {usersData?.total ?? 0} utilizadores encontrados
                  </p>
                  {usersData && usersData.pages > 1 && (
                    <span className="text-white/40 text-xs">Pág. {usersPage} / {usersData.pages}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {usersData?.users.map((user) => (
                    <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-white/10 flex-shrink-0 cursor-pointer" onClick={() => loadUserDetail(user.id)}>
                        {user.photos?.[0] ? (
                          <img src={user.photos[0]} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 text-lg font-black">
                            {user.name[0]}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">{user.name}</span>
                          {user.is_verified === 1 && (
                            <span className="bg-blue-500/20 text-blue-300 text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">✓</span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-white/30 text-xs">{user.age}a · {user.location}</span>
                          {user.match_count !== undefined && (
                            <span className="text-rose-400/60 text-xs">{user.match_count} matches</span>
                          )}
                          {user.message_count !== undefined && (
                            <span className="text-purple-400/60 text-xs">{user.message_count} msgs</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => loadUserDetail(user.id)}
                          title="Ver detalhes"
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white/60 rounded-lg flex items-center justify-center transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {user.is_verified === 1 ? (
                          <button
                            onClick={() => handleVerify(user.id, false)}
                            disabled={actionLoading === user.id}
                            title="Remover verificação"
                            className="w-8 h-8 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerify(user.id, true)}
                            disabled={actionLoading === user.id}
                            title="Verificar"
                            className="w-8 h-8 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={actionLoading === user.id}
                          title="Eliminar"
                          className="w-8 h-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {usersData && usersData.pages > 1 && (
                  <Pagination
                    page={usersPage}
                    pages={usersData.pages}
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
              <h2 className="text-lg font-black text-white">
                Matches <span className="text-white/40 font-normal text-base">({matchesData?.total ?? 0})</span>
              </h2>
            </div>

            {matchesLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="space-y-2">
                  {matchesData?.matches.map((m) => (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
                      {/* User 1 avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {m.user1_photos?.[0] ? (
                          <img src={m.user1_photos[0]} alt={m.user1_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-black">{m.user1_name[0]}</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">
                          {m.user1_name} <span className="text-[#FFCD00]">↔</span> {m.user2_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/30 text-xs">{timeAgo(m.created_at)}</span>
                          <span className="text-purple-400/70 text-xs">{m.message_count} msgs</span>
                        </div>
                      </div>

                      {/* User 2 avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {m.user2_photos?.[0] ? (
                          <img src={m.user2_photos[0]} alt={m.user2_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-black">{m.user2_name[0]}</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {matchesData?.matches.length === 0 && (
                    <p className="text-center text-white/30 py-12">Nenhum match ainda.</p>
                  )}
                </div>

                {matchesData && matchesData.pages > 1 && (
                  <Pagination
                    page={matchesPage}
                    pages={matchesData.pages}
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
              <h2 className="text-lg font-black text-white">Atividade Recente</h2>
              <button
                onClick={loadActivity}
                disabled={activityLoading}
                className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${activityLoading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>

            {activityLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-2">
                {activity.map((ev, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
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
                      {ev.email && <p className="text-white/40 text-xs truncate">{ev.email}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ev.type === "register" ? "bg-blue-500/20 text-blue-300"
                        : ev.type === "match" ? "bg-rose-500/20 text-rose-300"
                        : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {ev.type === "register" ? "Registo" : ev.type === "match" ? "Match" : "Mensagem"}
                      </span>
                      <p className="text-white/30 text-xs mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {timeAgo(ev.ts)}
                      </p>
                    </div>
                  </div>
                ))}

                {activity.length === 0 && (
                  <p className="text-center text-white/30 py-12">Nenhuma atividade recente.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {(userDetailLoading || selectedUser) && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }}
        >
          <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            {userDetailLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner /></div>
            ) : selectedUser && (
              <>
                {/* Modal header */}
                <div className="relative">
                  <div className="h-32 bg-gradient-to-br from-[#CE1126]/40 to-black rounded-t-2xl" />
                  <div className="absolute bottom-0 left-4 translate-y-1/2">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-900 bg-white/10">
                      {selectedUser.photos?.[0] ? (
                        <img src={selectedUser.photos[0]} alt={selectedUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/40">
                          {selectedUser.name[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 pt-12 pb-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-white">{selectedUser.name}</h3>
                      <p className="text-white/50 text-sm">{selectedUser.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                      {selectedUser.is_online && (
                        <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                          Online
                        </span>
                      )}
                      {selectedUser.is_verified === 1 && (
                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold">✓ Verificado</span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Matches", value: selectedUser.match_count ?? 0, color: "text-rose-400" },
                      { label: "Mensagens", value: selectedUser.message_count ?? 0, color: "text-purple-400" },
                      { label: "Swipes", value: selectedUser.swipe_count ?? 0, color: "text-orange-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-white/40 text-xs">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="bg-white/5 rounded-xl p-3 space-y-1.5 text-sm">
                    <InfoRow label="Idade" value={`${selectedUser.age} anos`} />
                    <InfoRow label="Localização" value={selectedUser.location} />
                    <InfoRow label="Género" value={selectedUser.gender} />
                    {selectedUser.work && <InfoRow label="Trabalho" value={selectedUser.work} />}
                    {selectedUser.bio && <InfoRow label="Bio" value={selectedUser.bio} />}
                    {selectedUser.interests?.length > 0 && (
                      <InfoRow label="Interesses" value={selectedUser.interests.join(", ")} />
                    )}
                    <InfoRow label="Membro desde" value={selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("pt-PT") : "-"} />
                  </div>

                  {/* Photos strip */}
                  {selectedUser.photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedUser.photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-20 h-28 object-cover rounded-xl flex-shrink-0" />
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    {selectedUser.is_verified === 1 ? (
                      <button
                        onClick={() => handleVerify(selectedUser.id, false)}
                        disabled={actionLoading === selectedUser.id}
                        className="flex-1 h-10 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        Remover verificação
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerify(selectedUser.id, true)}
                        disabled={actionLoading === selectedUser.id}
                        className="flex-1 h-10 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        Verificar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedUser.id, selectedUser.name)}
                      disabled={actionLoading === selectedUser.id}
                      className="flex-1 h-10 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </>
            )}
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

function StatCard({
  icon, label, value, color, live,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  live?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-5 h-5">{icon}</div>
        {live && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse mt-0.5" />}
      </div>
      <div className="text-xl sm:text-2xl font-black text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-white/50 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function Pagination({ page, pages, onPrev, onNext }: {
  page: number; pages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex justify-center items-center gap-3 mt-6">
      <button
        onClick={onPrev} disabled={page <= 1}
        className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl disabled:opacity-30 hover:bg-white/20 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-white/50">{page} / {pages}</span>
      <button
        onClick={onNext} disabled={page >= pages}
        className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl disabled:opacity-30 hover:bg-white/20 transition-colors"
      >
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
      <span className="text-white/40 flex-shrink-0 w-24">{label}</span>
      <span className="text-white/80 break-all">{value}</span>
    </div>
  );
}
