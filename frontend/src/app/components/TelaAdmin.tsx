import { useState, useEffect, useCallback } from "react";
import { Users, Heart, MessageCircle, ShieldCheck, Trash2, CheckCircle, XCircle, LogOut, Search, TrendingUp, UserCheck } from "lucide-react";

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
  users_today: number;
  matches_today: number;
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
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

export function TelaAdmin() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("admin_token"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users">("dashboard");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminRequest<Stats>("/stats");
      setStats(data);
    } catch {
      // token expired
      localStorage.removeItem("admin_token");
      setLoggedIn(false);
    }
  }, []);

  const loadUsers = useCallback(async (p = 1, s = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (s) params.set("search", s);
      const data = await adminRequest<UsersResponse>(`/users?${params}`);
      setUsersData(data);
    } catch {
      localStorage.removeItem("admin_token");
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadStats();
      if (activeTab === "users") loadUsers(page, search);
    }
  }, [loggedIn, activeTab, page]);

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
      setSuccessMsg(verify ? "Utilizador verificado!" : "Verificação removida!");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadUsers(page, search);
      loadStats();
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
      setSuccessMsg("Utilizador eliminado!");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadUsers(page, search);
      loadStats();
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
      setSuccessMsg("Limpeza concluída! Base de dados otimizada.");
      setTimeout(() => setSuccessMsg(""), 4000);
      loadStats();
    } catch {
      alert("Erro na limpeza");
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers(1, search);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLoggedIn(false);
  };

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-black border-b border-[#FFCD00]/20 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#FFCD00] rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#FFCD00] leading-none">AngoTinder Admin</h1>
            <p className="text-white/40 text-xs">Painel de controlo</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 px-6">
        <div className="flex gap-6">
          {(["dashboard", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === "users") loadUsers(1, ""); }}
              className={`py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab ? "border-[#FFCD00] text-[#FFCD00]" : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              {tab === "dashboard" ? "Dashboard" : "Utilizadores"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {successMsg && (
          <div className="mb-4 bg-green-900/50 border border-green-500 text-green-300 rounded-xl px-4 py-3 text-sm font-medium">
            {successMsg}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && stats && (
          <div>
            <h2 className="text-xl font-black text-white mb-6">Visão geral</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard icon={<Users className="w-6 h-6" />} label="Total Utilizadores" value={stats.total_users} color="blue" />
              <StatCard icon={<TrendingUp className="w-6 h-6" />} label="Novos Hoje" value={stats.users_today} color="green" />
              <StatCard icon={<UserCheck className="w-6 h-6" />} label="Verificados" value={stats.verified_users} color="yellow" />
              <StatCard icon={<Heart className="w-6 h-6" />} label="Total Matches" value={stats.total_matches} color="red" />
              <StatCard icon={<TrendingUp className="w-6 h-6" />} label="Matches Hoje" value={stats.matches_today} color="orange" />
              <StatCard icon={<MessageCircle className="w-6 h-6" />} label="Mensagens" value={stats.total_messages} color="purple" />
            </div>

            <div className="mt-8 bg-white/5 rounded-2xl p-5 border border-white/10">
              <h3 className="font-black text-white mb-3">Estado do Sistema</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Base de dados</span>
                  <span className="text-green-400 font-bold">PostgreSQL (Neon) ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Backend</span>
                  <span className="text-green-400 font-bold">Render.com ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Frontend</span>
                  <span className="text-green-400 font-bold">Netlify ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Domínio</span>
                  <span className="text-green-400 font-bold">angotinder.bafly.net ✓</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs mb-3">Limpeza manual: remove OTPs expirados, swipes antigos (+60 dias) e mensagens excedentes. Nunca apaga utilizadores.</p>
                <button
                  onClick={handleCleanup}
                  disabled={cleanupLoading}
                  className="w-full h-10 bg-[#FFCD00]/10 hover:bg-[#FFCD00]/20 border border-[#FFCD00]/30 text-[#FFCD00] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {cleanupLoading ? "A limpar..." : "🧹 Limpar Base de Dados Agora"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">
                Utilizadores {usersData && <span className="text-white/40 text-base font-normal">({usersData.total})</span>}
              </h2>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar nome ou email..."
                    className="pl-9 pr-4 h-10 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#FFCD00] w-64"
                  />
                </div>
                <button type="submit" className="h-10 px-4 bg-[#FFCD00] text-black font-bold rounded-xl text-sm hover:bg-[#FFD700] transition-colors">
                  Pesquisar
                </button>
              </form>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-[#FFCD00] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {usersData?.users.map((user) => (
                    <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate">{user.name}</span>
                          {user.is_verified === 1 && (
                            <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0">✓ Verificado</span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs truncate">{user.email}</p>
                        <p className="text-white/30 text-xs">{user.age} anos · {user.location} · {user.gender}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {user.is_verified === 1 ? (
                          <button
                            onClick={() => handleVerify(user.id, false)}
                            disabled={actionLoading === user.id}
                            title="Remover verificação"
                            className="w-9 h-9 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerify(user.id, true)}
                            disabled={actionLoading === user.id}
                            title="Verificar utilizador"
                            className="w-9 h-9 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={actionLoading === user.id}
                          title="Eliminar utilizador"
                          className="w-9 h-9 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {usersData && usersData.pages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => { setPage(p => p - 1); loadUsers(page - 1, search); }}
                      disabled={page <= 1}
                      className="px-4 py-2 bg-white/10 rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-white/20 transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="px-4 py-2 text-sm text-white/50">
                      {page} / {usersData.pages}
                    </span>
                    <button
                      onClick={() => { setPage(p => p + 1); loadUsers(page + 1, search); }}
                      disabled={page >= usersData.pages}
                      className="px-4 py-2 bg-white/10 rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-white/20 transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-black text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}
