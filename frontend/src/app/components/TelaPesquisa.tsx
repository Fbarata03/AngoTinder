import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Star, UserCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { ProfileModal } from "./ProfileModal";
import { socialApi, resolveMediaUrl, User as UserType } from "../api";
import { useApp } from "../context";

export function TelaPesquisa() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState<UserType | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback((q: string) => {
    setLoading(true);
    socialApi.search(q)
      .then((list) => { setUsers(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    fetchUsers("");
  }, [isLoggedIn, fetchUsers]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(val), 300);
  };

  const handleFollowToggle = useCallback((_targetId: string, nowFollowing: boolean) => {
    if (nowFollowing) return;
    // Refresh list after unfollow so counts stay accurate
    fetchUsers(query);
  }, [fetchUsers, query]);

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <AfricanPattern className="absolute top-0 right-0 w-80 h-80 text-primary opacity-5" />
        <AfricanPattern className="absolute bottom-20 left-0 w-80 h-80 text-secondary opacity-5" />
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black px-5 pt-5 pb-4 text-white shadow-xl flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <Search className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-black">Explorar</h1>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Pesquisar por nome, cidade ou bio..."
              className="w-full bg-white/15 backdrop-blur-sm border-2 border-white/20 rounded-2xl pl-10 pr-10 py-3 text-white placeholder-white/50 text-sm font-medium focus:outline-none focus:border-secondary/70 transition-colors"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); fetchUsers(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-24 relative z-10">
        <div className="max-w-4xl mx-auto px-1 py-2">
          {loading ? (
            <div className="grid grid-cols-3 gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 animate-pulse"
                />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-secondary" />
              </div>
              <p className="font-black text-lg text-foreground">Nenhum resultado</p>
              <p className="text-muted-foreground text-sm mt-1">
                {query ? `Sem resultados para "${query}"` : "Não há utilizadores disponíveis"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              <AnimatePresence>
                {users.map((user, i) => (
                  <motion.button
                    key={user.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => setViewProfile(user)}
                    className="aspect-square relative overflow-hidden group focus:outline-none"
                  >
                    {user.photos[0] ? (
                      <img
                        src={resolveMediaUrl(user.photos[0])}
                        alt={user.name}
                        className="w-full h-full object-cover transition-transform duration-200 group-active:scale-95"
                        loading="lazy"
                      />
                    ) : (
                      <UserPlaceholder name={user.name} />
                    )}

                    {/* Overlay on hover/active */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 group-active:bg-black/40 transition-colors" />

                    {/* Name overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-[11px] font-black truncate leading-tight">{user.name}</p>
                      {user.is_verified === 1 && (
                        <Star className="w-2.5 h-2.5 text-secondary fill-secondary absolute bottom-2 right-2" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <BottomNav active="explore" />

      <ProfileModal
        profile={viewProfile}
        onClose={() => setViewProfile(null)}
        showFollow
        onFollowChanged={handleFollowToggle}
      />
    </div>
  );
}

function UserPlaceholder({ name }: { name: string }) {
  const gradients: [string, string][] = [
    ["#CE1126", "#3D0000"],
    ["#8B0000", "#1a0000"],
    ["#D4A017", "#5c3a00"],
    ["#006400", "#003200"],
  ];
  const [from, to] = gradients[(name.charCodeAt(0) || 0) % gradients.length];
  return (
    <div
      className="w-full h-full flex items-center justify-center text-2xl font-black text-white"
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

export function UserCheck2({ className }: { className?: string }) {
  return <UserCheck className={className} />;
}
