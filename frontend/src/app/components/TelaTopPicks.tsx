import { useState, useEffect } from "react";
import { Star, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { motion } from "motion/react";
import { profilesApi, matchesApi, resolveMediaUrl, User as UserType } from "../api";
import { useApp } from "../context";
import { ProfileModal } from "./ProfileModal";
type TopPick = UserType & { reason: string };

export function TelaTopPicks() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [picks, setPicks] = useState<TopPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState<TopPick | null>(null);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    profilesApi.getTopPicks()
      .then((p) => { setPicks(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isLoggedIn]);

  const handleLike = async (userId: string) => {
    try {
      await matchesApi.swipe(userId, "right");
      setPicks((prev) => prev.filter((p) => p.id !== userId));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] flex flex-col relative">
      <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <Star className="w-6 h-6 text-black fill-black" />
            </div>
            <h1 className="text-2xl font-black">Top Picks</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary animate-pulse" />
            <p className="text-secondary font-bold">Selecionados especialmente para você hoje</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 pt-8 max-w-4xl mx-auto w-full relative z-10 pb-32">
        {loading ? (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-secondary fill-secondary animate-pulse mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">A carregar top picks...</p>
          </div>
        ) : picks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-12 h-12 text-secondary" />
            </div>
            <h3 className="text-xl font-black mb-2">Sem picks hoje</h3>
            <p className="text-muted-foreground font-medium">Volte amanhã para novos picks!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {picks.map((pick, i) => (
              <motion.div key={pick.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="relative aspect-[3/4] rounded-3xl overflow-hidden group cursor-pointer"
                onClick={() => setViewProfile(pick)}>
                {pick.photos[0] ? (
                  <img
                    src={resolveMediaUrl(pick.photos[0])}
                    alt={pick.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-5xl font-black text-white"
                    style={{ backgroundColor: ["#CE1126", "#8B0000", "#D4A017", "#006400"][pick.name.charCodeAt(0) % 4] }}
                  >
                    {pick.name[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                {pick.is_verified === 1 && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-gradient-to-r from-secondary to-[#FFD700] p-0.5 rounded-full">
                      <div className="bg-black/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 text-secondary fill-secondary" />
                        <span className="text-xs font-black text-secondary">VIP</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full border-2 border-secondary/50">
                    <p className="text-xs font-black text-secondary">{pick.reason}</p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-black text-xl">{pick.name}</h3>
                        <span className="text-white font-black text-xl">{pick.age}</span>
                      </div>
                      <p className="text-white/80 text-sm font-medium">{pick.location}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(pick.id); }}
                      className="bg-gradient-to-br from-secondary to-[#FFD700] p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <Heart className="w-5 h-5 text-black fill-black" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ProfileModal
        profile={viewProfile}
        onClose={() => setViewProfile(null)}
        onLike={viewProfile ? () => { handleLike(viewProfile.id); setViewProfile(null); } : undefined}
        likeLabel="Dar Like"
      />

      <BottomNav active="discover" />
    </div>
  );
}
