import { useState, useEffect, useCallback } from "react";
import { Heart, Star, Sparkles, X, Search } from "lucide-react";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "motion/react";
import { profilesApi, matchesApi, resolveMediaUrl, User as UserType } from "../api";
import { useApp } from "../context";
import { ProfileModal } from "./ProfileModal";
import { Button } from "./ui/button";

export function TelaLikes() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [likes, setLikes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<UserType | null>(null);

  const refreshLikes = useCallback(() => {
    profilesApi.getLikes().then((l) => { setLikes(l); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    refreshLikes();
    // Refresh when tab becomes visible (user returns from swipe)
    const onVisible = () => { if (document.visibilityState === "visible") refreshLikes(); };
    document.addEventListener("visibilitychange", onVisible);
    // Refresh when a new match happens (someone liked back)
    const onMatch = () => refreshLikes();
    window.addEventListener("angotinder:new_match", onMatch);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("angotinder:new_match", onMatch);
    };
  }, [isLoggedIn, refreshLikes]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handlePass = async (userId: string) => {
    if (pendingIds.has(userId)) return;
    setPendingIds((s) => new Set(s).add(userId));
    try {
      await matchesApi.swipe(userId, "left");
      setLikes((prev) => prev.filter((u) => u.id !== userId));
    } catch { /* ignore */ } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(userId); return n; });
    }
  };

  const handleLikeBack = async (likedUser: UserType) => {
    if (pendingIds.has(likedUser.id)) return;
    setPendingIds((s) => new Set(s).add(likedUser.id));
    try {
      const res = await matchesApi.swipe(likedUser.id, "right");
      // Remove from list immediately (already liked back or matched)
      setLikes((prev) => prev.filter((u) => u.id !== likedUser.id));
      if (res.is_match && res.match_id) {
        navigate("/chat", {
          state: {
            matchId: res.match_id,
            matchedProfile: {
              id: likedUser.id,
              name: likedUser.name,
              photos: likedUser.photos,
              age: likedUser.age,
              location: likedUser.location,
            },
          },
        });
      } else {
        showToast(`Like enviado a ${likedUser.name}! 💛`);
      }
    } catch {
      showToast("Erro ao enviar like. Tente novamente.");
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(likedUser.id); return n; });
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] flex flex-col relative">
      <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <Heart className="w-6 h-6 text-black fill-black" />
            </div>
            <h1 className="text-2xl font-black">Quem Deu Like</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary animate-pulse" />
            <p className="text-secondary font-bold">{likes.length} {likes.length === 1 ? "pessoa curtiu você" : "pessoas curtiram você"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 pt-8 max-w-4xl mx-auto w-full relative z-10 pb-32">
        {loading ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-primary fill-primary animate-pulse mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">A carregar likes...</p>
          </div>
        ) : likes.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-28 h-28 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-secondary/30"
            >
              <Heart className="w-14 h-14 text-primary" />
            </motion.div>
            <h3 className="text-2xl font-black mb-2">Ainda sem likes</h3>
            <p className="text-muted-foreground font-medium mb-8 max-w-xs">
              Vai descobrir pessoas e dá likes — elas podem curtir-te de volta!
            </p>
            <Button
              onClick={() => navigate("/discover")}
              className="bg-gradient-to-r from-primary via-[#8B0000] to-black hover:opacity-90 text-white rounded-2xl font-black text-base px-8 py-5 shadow-xl shadow-primary/30 border-2 border-secondary/40 flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Descobrir Pessoas
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {likes.map((like, i) => (
                <motion.div
                  key={like.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.05 }}
                  className="relative aspect-[3/4] rounded-3xl overflow-hidden group cursor-pointer"
                  onClick={() => setViewProfile(like)}
                >
                  {like.photos[0] ? (
                    <img src={resolveMediaUrl(like.photos[0])} alt={like.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white"
                      style={{ backgroundColor: ["#CE1126","#8B0000","#D4A017","#006400"][like.name.charCodeAt(0) % 4] }}>
                      {like.name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  {like.is_verified === 1 && (
                    <div className="absolute top-3 right-3">
                      <div className="bg-gradient-to-r from-secondary to-[#FFD700] p-0.5 rounded-full">
                        <div className="bg-black/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 text-secondary fill-secondary" />
                          <span className="text-xs font-black text-secondary">VIP</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-black text-base">{like.name}, {like.age}</p>
                    <p className="text-white/70 text-xs font-medium">{like.location}</p>
                  </div>
                  {/* Pass button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePass(like.id); }}
                    disabled={pendingIds.has(like.id)}
                    className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-white/20 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  {/* Like back button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLikeBack(like); }}
                    disabled={pendingIds.has(like.id)}
                    className="absolute bottom-3 right-3 bg-gradient-to-br from-secondary to-[#FFD700] p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-wait"
                  >
                    <Heart className={`w-5 h-5 text-black ${pendingIds.has(like.id) ? "animate-pulse" : "fill-black"}`} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ProfileModal
        profile={viewProfile}
        onClose={() => setViewProfile(null)}
        onLike={viewProfile ? () => { handleLikeBack(viewProfile); setViewProfile(null); } : undefined}
        onPass={viewProfile ? () => { handlePass(viewProfile.id); setViewProfile(null); } : undefined}
        likeLabel="Dar Like"
      />

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-black/90 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 max-w-xs text-center"
          >
            <span className="font-bold text-sm">{toast}</span>
            <button onClick={() => setToast(null)} className="text-white/60 hover:text-white ml-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav active="chats" />
    </div>
  );
}
