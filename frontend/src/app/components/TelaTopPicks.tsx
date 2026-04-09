import { useState, useEffect } from "react";
import { Heart, User, MessageCircle, Star, Crown, Sparkles, Info } from "lucide-react";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { profilesApi, User as UserType } from "../api";
import { useApp } from "../context";
import { MOCK_PROFILES } from "../mockData";

type TopPick = UserType & { reason: string };

export function TelaTopPicks() {
  const navigate = useNavigate();
  const { userId, isLoggedIn } = useApp();
  const [picks, setPicks] = useState<TopPick[]>([]);
  const [loading, setLoading] = useState(true);
  const isPremiumUser = false;

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    profilesApi.getTopPicks(userId)
      .then((p) => { setPicks(p.length > 0 ? p : MOCK_PROFILES.map((u, i) => ({ ...u, reason: ["Compartilha seus interesses","Mora perto de você","Perfil muito ativo","Match em potencial","Curtiu suas fotos","Perfil verificado"][i % 6] }))); setLoading(false); })
      .catch(() => { setPicks(MOCK_PROFILES.map((u, i) => ({ ...u, reason: ["Compartilha seus interesses","Mora perto de você","Perfil muito ativo","Match em potencial","Curtiu suas fotos","Perfil verificado"][i % 6] }))); setLoading(false); });
  }, [userId, isLoggedIn]);

  const visiblePicks = isPremiumUser ? picks : picks.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] flex flex-col relative overflow-hidden">
      <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
                <Star className="w-6 h-6 text-black fill-black" />
              </div>
              <h1 className="text-2xl font-black">Top Picks</h1>
            </div>
            <button className="p-2 hover:bg-white/20 rounded-xl transition-colors"><Info className="w-6 h-6" /></button>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary animate-pulse" />
            <p className="text-secondary font-bold">Selecionados especialmente para você hoje</p>
          </div>
        </div>
      </div>

      <div className="p-6 pb-0 max-w-4xl mx-auto w-full relative z-10">
        <div className="bg-gradient-to-r from-secondary/20 to-[#FFD700]/20 border-4 border-secondary/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl flex-shrink-0">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-black text-base mb-1">Escolhas Diárias</h3>
            <p className="text-sm text-muted-foreground font-medium">
              {isPremiumUser ? "Você tem acesso ilimitado aos Top Picks!" : "3 picks gratuitos por dia. Assine o AngoTinder Gold para mais!"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 pt-8 max-w-4xl mx-auto w-full relative z-10 pb-32">
        {loading ? (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-secondary fill-secondary animate-pulse mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">A carregar top picks...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visiblePicks.map((pick, i) => (
              <motion.div key={pick.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="relative aspect-[3/4] rounded-3xl overflow-hidden group cursor-pointer">
                <img src={pick.photos[0]} alt={pick.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
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
                      <p className="text-white/80 text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-secondary text-secondary" /> {pick.location}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2.5 rounded-full shadow-lg">
                      <Heart className="w-5 h-5 text-black" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}

            {!isPremiumUser && picks.slice(3).map((_, i) => (
              <motion.div key={`locked-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (visiblePicks.length + i) * 0.08 }}
                className="relative aspect-[3/4] rounded-3xl overflow-hidden cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-black/40 backdrop-blur-xl" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-1 rounded-full mb-4">
                    <div className="bg-black p-4 rounded-full">
                      <Crown className="w-12 h-12 text-secondary" />
                    </div>
                  </div>
                  <p className="text-white font-black text-center text-base mb-2">Mais {picks.length - visiblePicks.length} Picks</p>
                  <p className="text-white/80 text-sm text-center font-medium">Assine o Gold para desbloquear</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!isPremiumUser && picks.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8">
            <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl">
              <div className="bg-gradient-to-br from-black via-[#1a0000] to-black p-6 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-3 rounded-2xl flex-shrink-0">
                    <Crown className="w-8 h-8 text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-white mb-1">Desbloqueie Todos os Top Picks!</h3>
                    <p className="text-white/80 text-sm font-medium">Veja perfis ilimitados selecionados para você</p>
                  </div>
                </div>
                <button className="mt-4 w-full bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black text-base py-3 rounded-xl transition-opacity">
                  Assinar AngoTinder Gold
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<Star className="w-6 h-6 fill-current" />} label="Top Picks" onClick={() => navigate("/top-picks")} active={true} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={false} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
        </div>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
      <div className={`p-3 rounded-2xl transition-colors ${active ? "bg-gradient-to-br from-primary/20 to-secondary/20" : "hover:bg-secondary/10"}`}>{icon}</div>
      <span className="text-xs font-black">{label}</span>
    </button>
  );
}
