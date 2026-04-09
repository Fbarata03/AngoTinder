import { useState, useEffect } from "react";
import { Heart, X, MapPin, Briefcase, MessageCircle, Star, Sparkles, RotateCcw, Zap, Sliders, User } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { motion, useMotionValue, useTransform } from "motion/react";
import { AfricanPattern } from "./AfricanPatterns";
import { MatchModal } from "./MatchModal";
import { FiltersModal, Filters } from "./FiltersModal";
import { profilesApi, matchesApi, User as UserType } from "../api";
import { useApp } from "../context";

function SwipeCard({ profile, onSwipe }: { profile: UserType; onSwipe: (dir: "left" | "right") => void }) {
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) onSwipe("right");
    else if (info.offset.x < -100) onSwipe("left");
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border-4 border-secondary/30">
        <div className="relative h-[65%]">
          <img src={profile.photos[currentPhoto] || "https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=800"}
            alt={profile.name} className="w-full h-full object-cover" />

          <div className="absolute top-6 right-6 bg-gradient-to-r from-secondary via-[#FFD700] to-secondary p-0.5 rounded-full">
            <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 text-secondary fill-secondary" />
              <span className="text-xs font-bold text-secondary">VERIFICADO</span>
            </div>
          </div>

          <div className="absolute top-4 left-0 right-0 flex gap-2 px-4">
            {profile.photos.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm border border-secondary/30">
                {i === currentPhoto && <div className="h-full bg-gradient-to-r from-secondary to-[#FFD700] rounded-full" />}
              </div>
            ))}
          </div>

          <div className="absolute inset-0 flex">
            <button className="flex-1" onClick={() => setCurrentPhoto(Math.max(0, currentPhoto - 1))} />
            <button className="flex-1" onClick={() => setCurrentPhoto(Math.min(profile.photos.length - 1, currentPhoto + 1))} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent">
            <AfricanPattern className="absolute inset-0 text-secondary opacity-10" />
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-black via-[#1a0000] to-black p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-3xl font-black text-white">{profile.name}</h2>
            <span className="text-3xl font-black text-secondary">{profile.age}</span>
            <Sparkles className="w-5 h-5 text-secondary animate-pulse" />
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-secondary/90">
              <div className="bg-secondary/20 p-1.5 rounded-lg"><MapPin className="w-4 h-4" /></div>
              <span className="font-medium">{profile.location}</span>
            </div>
            {profile.work && (
              <div className="flex items-center gap-2.5 text-secondary/90">
                <div className="bg-secondary/20 p-1.5 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                <span className="font-medium">{profile.work}</span>
              </div>
            )}
          </div>
          {profile.bio && <p className="mt-4 text-white/90 leading-relaxed line-clamp-2">{profile.bio}</p>}
        </div>

        <motion.div style={{ opacity: likeOpacity }}
          className="absolute top-1/3 right-8 bg-gradient-to-br from-secondary via-[#FFD700] to-secondary p-1 rounded-3xl rotate-12 shadow-2xl">
          <div className="bg-black px-8 py-4 rounded-3xl">
            <span className="text-secondary font-black text-2xl drop-shadow-lg">GOSTEI</span>
          </div>
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }}
          className="absolute top-1/3 left-8 bg-gradient-to-br from-[#CE1126] to-[#8B0000] p-1 rounded-3xl -rotate-12 shadow-2xl">
          <div className="bg-black px-8 py-4 rounded-3xl">
            <span className="text-[#CE1126] font-black text-2xl drop-shadow-lg">NOPE</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function TelaDescoberta() {
  const navigate = useNavigate();
  const { currentUser, isLoggedIn } = useApp();
  const [profiles, setProfiles] = useState<UserType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<UserType[]>([]);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<UserType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ageRange: [18, 35], distance: 50, showVerifiedOnly: false, gender: "all" });
  const [superLikesLeft, setSuperLikesLeft] = useState(1);
  const [boostActive, setBoostActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    profilesApi.discover()
      .then((p) => { setProfiles(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isLoggedIn]);

  const handleSwipe = async (dir: "left" | "right" | "super") => {
    const profile = profiles[currentIndex];
    if (!profile) return;

    setHistory((h) => [...h, profile]);

    try {
      const res = await matchesApi.swipe(profile.id, dir === "super" ? "super" : dir);
      if (res.is_match) {
        setMatchedProfile(profile);
        setShowMatch(true);
      }
    } catch { /* offline */ }

    setTimeout(() => setCurrentIndex((i) => i + 1), 200);
  };

  const handleRewind = () => {
    if (history.length > 0 && currentIndex > 0) {
      setHistory((h) => h.slice(0, -1));
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!isLoggedIn) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-20 h-20 text-secondary fill-secondary animate-pulse mx-auto mb-4" />
          <p className="text-white font-bold text-xl">A carregar perfis...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex flex-col relative overflow-hidden">
        <AfricanPattern className="absolute inset-0 text-secondary opacity-10" />
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="relative inline-block mb-8">
              <div className="bg-gradient-to-br from-secondary via-[#FFD700] to-secondary p-2 rounded-full">
                <div className="bg-black p-8 rounded-full">
                  <Heart className="w-20 h-20 text-secondary fill-secondary" />
                </div>
              </div>
            </motion.div>
            <h2 className="text-4xl font-black text-white mb-4">Sem mais perfis!</h2>
            <p className="text-white/70 mb-8 text-lg">Volte mais tarde para conhecer<br />novas pessoas incríveis 🔥</p>
            <Button onClick={() => { setCurrentIndex(0); setHistory([]); }}
              className="bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black text-lg px-8 py-6 rounded-2xl shadow-xl">
              Ver Novamente
            </Button>
          </div>
        </div>
        <BottomNav navigate={navigate} active="discover" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] flex flex-col relative overflow-hidden">
      <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="px-6 pt-6 max-w-4xl mx-auto w-full relative z-10">
        <button onClick={() => navigate("/top-picks")}
          className="w-full bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl shadow-lg">
          <div className="bg-gradient-to-br from-black via-[#1a0000] to-black p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
                <Star className="w-6 h-6 text-black fill-black" />
              </div>
              <div className="text-left">
                <h3 className="font-black text-white">Top Picks de Hoje</h3>
                <p className="text-secondary text-sm font-bold">Selecionados especialmente para você</p>
              </div>
            </div>
            <Sparkles className="w-6 h-6 text-secondary animate-pulse" />
          </div>
        </button>
      </motion.div>

      <div className="p-6 flex items-center justify-between max-w-4xl mx-auto w-full relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-[#8B0000] p-2 rounded-2xl">
            <Heart className="w-7 h-7 text-secondary fill-secondary" />
          </div>
          <div>
            <span className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">AngoTinder</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground font-bold">{boostActive ? "BOOST ATIVO 🔥" : "ONLINE"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setBoostActive(true); setTimeout(() => setBoostActive(false), 1800000); }}
            className={`p-3 rounded-2xl transition-all ${boostActive ? "bg-gradient-to-br from-secondary to-[#FFD700] shadow-lg" : "hover:bg-secondary/10"}`}>
            <Zap className={`w-6 h-6 ${boostActive ? "text-black fill-black" : "text-primary"}`} />
          </motion.button>
          <button onClick={() => setShowFilters(true)} className="p-3 hover:bg-secondary/10 rounded-2xl transition-colors">
            <Sliders className="w-6 h-6 text-primary" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-40 max-w-md mx-auto w-full relative z-10">
        <div className="relative h-full min-h-[500px]">
          {profiles.slice(currentIndex, currentIndex + 2).reverse().map((profile) => (
            <SwipeCard key={profile.id} profile={profile} onSwipe={handleSwipe} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-32 left-0 right-0 px-6 z-20">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleRewind}
            className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-secondary/30 hover:border-secondary transition-all" disabled={history.length === 0}>
            <RotateCcw className="w-7 h-7 text-secondary" strokeWidth={2.5} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleSwipe("left")}
            className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-[#CE1126]/30 hover:border-[#CE1126] transition-all">
            <X className="w-10 h-10 text-[#CE1126]" strokeWidth={3} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }} onClick={() => handleSwipe("right")}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] shadow-2xl shadow-secondary/50 flex items-center justify-center">
            <div className="absolute inset-0 bg-secondary rounded-full blur-xl opacity-50 animate-pulse"></div>
            <Heart className="relative w-12 h-12 text-black fill-black drop-shadow-lg" strokeWidth={2.5} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { if (superLikesLeft > 0) { setSuperLikesLeft((n) => n - 1); handleSwipe("super"); } }}
            className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#00C9FF] to-[#0080FF] shadow-2xl flex items-center justify-center border-4 border-blue-300/50 hover:border-blue-400 transition-all">
            <Star className="w-9 h-9 text-white fill-white" strokeWidth={2.5} />
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-secondary to-[#FFD700] rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs font-black text-black">{superLikesLeft}</span>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { setBoostActive(true); setTimeout(() => setBoostActive(false), 1800000); }}
            className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center border-4 transition-all ${boostActive ? "bg-gradient-to-br from-secondary to-[#FFD700] border-secondary/50" : "bg-white border-purple-300 hover:border-purple-500"}`}>
            <Zap className={`w-7 h-7 ${boostActive ? "text-black fill-black" : "text-purple-600 fill-purple-600"}`} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>

      <BottomNav navigate={navigate} active="discover" />

      <MatchModal
        isOpen={showMatch}
        onClose={() => setShowMatch(false)}
        onSendMessage={() => { setShowMatch(false); navigate("/chat"); }}
        matchedProfile={{ name: matchedProfile?.name || "", photo: matchedProfile?.photos[0] || "" }}
        userPhoto={currentUser?.photos[0] || "https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=400"}
      />
      <FiltersModal isOpen={showFilters} onClose={() => setShowFilters(false)} onApply={setFilters} initial={filters} />
    </div>
  );
}

function BottomNav({ navigate, active }: { navigate: (path: string) => void; active: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
        <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={active === "discover"} />
        <NavBtn icon={<Heart className="w-6 h-6 fill-current" />} label="Likes" onClick={() => navigate("/likes")} active={active === "likes"} badge="6" />
        <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={active === "chat"} />
        <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={active === "profile"} />
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
