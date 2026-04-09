import { useState, useEffect } from "react";
import { Heart, User, MessageCircle, Crown, Star, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { profilesApi, User as UserType } from "../api";
import { useApp } from "../context";

export function TelaLikes() {
  const navigate = useNavigate();
  const { userId, isLoggedIn } = useApp();
  const [likes, setLikes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const isPremiumUser = false;

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    profilesApi.getLikes(userId).then((l) => { setLikes(l); setLoading(false); }).catch(() => setLoading(false));
  }, [userId, isLoggedIn]);

  // For demo: always show some likes
  const displayLikes = likes.length > 0 ? likes : [
    { id: "1", photos: ["https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=400"], name: "Ana", age: 26, is_verified: 1 } as UserType,
    { id: "2", photos: ["https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400"], name: "Sofia", age: 24, is_verified: 1 } as UserType,
    { id: "3", photos: ["https://images.unsplash.com/photo-1619194617426-f460de77ff72?w=400"], name: "Joana", age: 29, is_verified: 0 } as UserType,
    { id: "4", photos: ["https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?w=400"], name: "Isabel", age: 27, is_verified: 0 } as UserType,
    { id: "5", photos: ["https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=400"], name: "Beatriz", age: 25, is_verified: 0 } as UserType,
    { id: "6", photos: ["https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400"], name: "Carolina", age: 28, is_verified: 0 } as UserType,
  ];

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
            <p className="text-secondary font-bold">{displayLikes.length} pessoas curtiram você</p>
          </div>
        </div>
      </div>

      {!isPremiumUser && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-20 mx-6 mt-6">
          <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl shadow-2xl">
            <div className="bg-gradient-to-br from-black via-[#1a0000] to-black p-6 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-3 rounded-2xl">
                  <Crown className="w-8 h-8 text-black" />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-xl text-white mb-2">Seja Premium!</h3>
                  <p className="text-white/80 text-sm font-medium mb-4">Veja quem curtiu você e dê match instantâneo!</p>
                  <Button className="bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black rounded-xl h-12 px-6">
                    Assinar AngoTinder Gold
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex-1 p-6 pt-8 max-w-4xl mx-auto w-full relative z-10 pb-32">
        <div className="grid grid-cols-2 gap-4">
          {displayLikes.map((like, i) => (
            <motion.div key={like.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }} className="relative aspect-[3/4] rounded-3xl overflow-hidden group cursor-pointer">
              <img src={like.photos[0]} alt="Like"
                className={`w-full h-full object-cover transition-all ${!isPremiumUser ? "blur-xl scale-110" : "group-hover:scale-105"}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
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
              {!isPremiumUser && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-1 rounded-full mb-3">
                    <div className="bg-black p-4 rounded-full">
                      <Crown className="w-10 h-10 text-secondary" />
                    </div>
                  </div>
                  <p className="text-white font-black text-sm text-center px-4">Seja Premium<br />para ver</p>
                </div>
              )}
              {isPremiumUser && (
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white font-black text-lg">{like.name}, {like.age}</p>
                </div>
              )}
              <div className="absolute bottom-3 left-3">
                <div className="bg-gradient-to-br from-primary to-[#8B0000] p-2 rounded-full shadow-lg">
                  <Heart className="w-6 h-6 text-white fill-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<Heart className="w-6 h-6 fill-current" />} label="Likes" onClick={() => navigate("/likes")} active={true} badge={String(displayLikes.length)} />
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
