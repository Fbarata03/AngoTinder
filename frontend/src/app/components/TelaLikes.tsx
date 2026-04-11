import { useState, useEffect } from "react";
import { Heart, User, MessageCircle, Star, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { profilesApi, matchesApi, User as UserType } from "../api";
import { useApp } from "../context";

export function TelaLikes() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [likes, setLikes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    profilesApi.getLikes().then((l) => { setLikes(l); setLoading(false); }).catch(() => setLoading(false));
  }, [isLoggedIn]);

  const handleLikeBack = async (likedUser: UserType) => {
    try {
      const res = await matchesApi.swipe(likedUser.id, "right");
      setLikes((prev) => prev.filter((u) => u.id !== likedUser.id));
      if (res.is_match && res.match_id) {
        navigate("/chat", {
          state: {
            matchId: res.match_id,
            matchedProfile: {
              id: likedUser.id, name: likedUser.name,
              photos: likedUser.photos, age: likedUser.age, location: likedUser.location,
            },
          },
        });
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] flex flex-col relative overflow-hidden">
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
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-black mb-2">Ainda sem likes</h3>
            <p className="text-muted-foreground font-medium">Continue a deslizar para ganhar mais likes!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {likes.map((like, i) => (
              <motion.div key={like.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }} className="relative aspect-[3/4] rounded-3xl overflow-hidden group cursor-pointer">
                {like.photos[0] ? (
                  <img src={like.photos[0]} alt={like.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
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
                {/* Like back button */}
                <button
                  onClick={() => handleLikeBack(like)}
                  className="absolute bottom-3 right-3 bg-gradient-to-br from-secondary to-[#FFD700] p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Heart className="w-5 h-5 text-black fill-black" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<Heart className="w-6 h-6 fill-current" />} label="Likes" onClick={() => navigate("/likes")} active={true} badge={likes.length > 0 ? String(likes.length) : undefined} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={false} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
        </div>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick, active, badge }: { icon: React.ReactNode; label: string; onClick: () => void; active: boolean; badge?: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
      <div className={`p-3 rounded-2xl relative transition-colors ${active ? "bg-gradient-to-br from-primary/20 to-secondary/20" : "hover:bg-secondary/10"}`}>
        {icon}
        {badge && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-primary to-[#8B0000] rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-xs font-black text-white">{badge}</span>
          </div>
        )}
      </div>
      <span className="text-xs font-black">{label}</span>
    </button>
  );
}
