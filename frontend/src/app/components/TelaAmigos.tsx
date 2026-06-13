import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Clock, Check, X, MessageCircle, UserMinus, Star } from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { friendsApi, FriendRequest, resolveMediaUrl } from "../api";
import { useApp } from "../context";

type Tab = "friends" | "received" | "sent";

function Avatar({ photo, name, size = "md" }: { photo?: string; name: string; size?: "sm" | "md" | "lg" }) {
  const colors = ["#CE1126", "#8B0000", "#D4A017", "#006400", "#003E7E"];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
  const sizeClass = size === "sm" ? "w-10 h-10 text-sm" : size === "lg" ? "w-16 h-16 text-xl" : "w-12 h-12 text-base";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "?";

  if (photo) {
    return <img src={resolveMediaUrl(photo)} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-black text-white flex-shrink-0`} style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-black text-lg text-foreground">{title}</p>
      <p className="text-muted-foreground text-sm mt-1">{sub}</p>
    </div>
  );
}

export function TelaAmigos() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const [f, r, s] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getReceivedRequests(),
        friendsApi.getSentRequests(),
      ]);
      setFriends(f);
      setReceived(r);
      setSent(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    load();
  }, [isLoggedIn, load, navigate]);

  // Listen for real-time friend events
  useEffect(() => {
    const onFriendRequest = () => load();
    const onFriendAccepted = () => load();
    window.addEventListener("angotinder:friend_request", onFriendRequest);
    window.addEventListener("angotinder:friend_accepted", onFriendAccepted);
    return () => {
      window.removeEventListener("angotinder:friend_request", onFriendRequest);
      window.removeEventListener("angotinder:friend_accepted", onFriendAccepted);
    };
  }, [load]);

  const handleAccept = async (req: FriendRequest) => {
    setActionId(req.request_id);
    try {
      await friendsApi.acceptRequest(req.request_id);
      await load();
    } catch { /* ignore */ } finally { setActionId(null); }
  };

  const handleReject = async (req: FriendRequest) => {
    setActionId(req.request_id);
    try {
      await friendsApi.rejectRequest(req.request_id);
      setReceived(prev => prev.filter(r => r.request_id !== req.request_id));
    } catch { /* ignore */ } finally { setActionId(null); }
  };

  const handleCancel = async (req: FriendRequest) => {
    setActionId(req.request_id);
    try {
      await friendsApi.cancelRequest(req.request_id);
      setSent(prev => prev.filter(r => r.request_id !== req.request_id));
    } catch { /* ignore */ } finally { setActionId(null); }
  };

  const handleRemove = async (req: FriendRequest) => {
    if (!confirm(`Remover ${req.name} dos amigos?`)) return;
    setActionId(req.request_id);
    try {
      await friendsApi.removeFriend(req.id);
      setFriends(prev => prev.filter(f => f.id !== req.id));
    } catch { /* ignore */ } finally { setActionId(null); }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "Amigos", count: friends.length },
    { id: "received", label: "Pedidos", count: received.length },
    { id: "sent", label: "Enviados", count: sent.length },
  ];

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <AfricanPattern className="absolute top-0 right-0 w-80 h-80 text-primary opacity-5" />
        <AfricanPattern className="absolute bottom-20 left-0 w-80 h-80 text-secondary opacity-5" />
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black px-5 pt-5 pb-0 text-white shadow-xl flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <Users className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-black">Amigos</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 pb-3 pt-1 text-sm font-black transition-colors relative ${
                  tab === t.id ? "text-secondary" : "text-white/50 hover:text-white/80"
                }`}
              >
                {t.label}
                {(t.count ?? 0) > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    tab === t.id ? "bg-secondary text-black" : "bg-white/20 text-white"
                  }`}>
                    {t.count}
                  </span>
                )}
                {tab === t.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-28 relative z-10">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-primary/10 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {tab === "friends" && (
                <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {friends.length === 0 ? (
                    <EmptyState
                      icon={<Users className="w-10 h-10 text-secondary" />}
                      title="Ainda não tens amigos"
                      sub="Começa a explorar perfis e adiciona amigos!"
                    />
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {friends.map((f, i) => (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-4 hover:bg-card/50"
                        >
                          <Avatar photo={f.photos[0]} name={f.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-foreground truncate">{f.name}</p>
                              {f.is_verified === 1 && <Star className="w-3.5 h-3.5 text-secondary fill-secondary flex-shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{f.location} · {f.age} anos</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => navigate("/chat")}
                              className="w-9 h-9 bg-secondary/20 hover:bg-secondary/40 rounded-xl flex items-center justify-center transition-colors"
                              title="Enviar mensagem"
                            >
                              <MessageCircle className="w-4 h-4 text-secondary" />
                            </button>
                            <button
                              onClick={() => handleRemove(f)}
                              disabled={actionId === f.request_id}
                              className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                              title="Remover amigo"
                            >
                              <UserMinus className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === "received" && (
                <motion.div key="received" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {received.length === 0 ? (
                    <EmptyState
                      icon={<UserPlus className="w-10 h-10 text-secondary" />}
                      title="Nenhum pedido pendente"
                      sub="Quando alguém te adicionar, aparecerá aqui"
                    />
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {received.map((r, i) => (
                        <motion.div
                          key={r.request_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-4"
                        >
                          <Avatar photo={r.photos[0]} name={r.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-foreground truncate">{r.name}</p>
                              {r.is_verified === 1 && <Star className="w-3.5 h-3.5 text-secondary fill-secondary flex-shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{r.location} · {r.age} anos</p>
                            {r.bio && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{r.bio}</p>}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleAccept(r)}
                              disabled={actionId === r.request_id}
                              className="w-9 h-9 bg-green-500 hover:bg-green-400 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shadow-md"
                              title="Aceitar"
                            >
                              <Check className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={() => handleReject(r)}
                              disabled={actionId === r.request_id}
                              className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                              title="Recusar"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === "sent" && (
                <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {sent.length === 0 ? (
                    <EmptyState
                      icon={<Clock className="w-10 h-10 text-secondary" />}
                      title="Nenhum pedido enviado"
                      sub="Os pedidos que enviares aparecerão aqui"
                    />
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {sent.map((s, i) => (
                        <motion.div
                          key={s.request_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-4"
                        >
                          <Avatar photo={s.photos[0]} name={s.name} />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-foreground truncate">{s.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{s.location} · {s.age} anos</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground/60">Aguardando resposta</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancel(s)}
                            disabled={actionId === s.request_id}
                            className="px-3 py-1.5 text-xs font-black text-red-400 border border-red-400/30 rounded-xl hover:bg-red-400/10 transition-colors disabled:opacity-40"
                          >
                            Cancelar
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      <BottomNav active="contacts" />
    </div>
  );
}
