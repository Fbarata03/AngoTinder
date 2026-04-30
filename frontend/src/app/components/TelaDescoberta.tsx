import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, X, MapPin, Briefcase, MessageCircle, Star, Sparkles, RotateCcw, Zap, Sliders, User } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { motion, useMotionValue, useTransform, animate, MotionValue } from "motion/react";
import { AfricanPattern } from "./AfricanPatterns";
import { MatchModal } from "./MatchModal";
import { FiltersModal, Filters } from "./FiltersModal";
import { profilesApi, matchesApi, notificationsApi, resolveMediaUrl, User as UserType } from "../api";
import { useApp } from "../context";

const SUPER_KEY = "angotinder_super_likes";
const SUPER_DATE_KEY = "angotinder_super_likes_date";

function getSuperLikesInitial(): number {
  try {
    const today = new Date().toDateString();
    if (localStorage.getItem(SUPER_DATE_KEY) !== today) {
      localStorage.setItem(SUPER_DATE_KEY, today);
      localStorage.setItem(SUPER_KEY, "1");
      return 1;
    }
    const n = parseInt(localStorage.getItem(SUPER_KEY) || "1", 10);
    return isNaN(n) ? 1 : Math.max(0, n);
  } catch { return 1; }
}

function saveSuperLikes(n: number) {
  try { localStorage.setItem(SUPER_KEY, String(n)); } catch { /* ignore */ }
}

function PhotoPlaceholder({ name, className = "" }: { name: string; className?: string }) {
  const gradients = [
    ["#CE1126", "#3D0000"],
    ["#8B0000", "#1a0000"],
    ["#D4A017", "#5c3a00"],
    ["#006400", "#003200"],
    ["#003E7E", "#001030"],
  ];
  const [from, to] = gradients[name.charCodeAt(0) % gradients.length];
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div
      className={`relative flex flex-col items-center justify-end ${className}`}
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.18] fill-white pointer-events-none"
        viewBox="0 0 200 280"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <circle cx="100" cy="72" r="44" />
        <path d="M22 290 Q22 162 100 162 Q178 162 178 290 Z" />
      </svg>
      <div className="relative z-10 mb-[18%]">
        <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/35 flex items-center justify-center shadow-2xl">
          <span className="text-white font-black drop-shadow-lg" style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)" }}>
            {initials}
          </span>
        </div>
      </div>
    </div>
  );
}

interface SwipeCardProps {
  profile: UserType;
  /** Called after the exit animation completes */
  onSwipe: (dir: "left" | "right") => void;
  /** Only the top card is interactive */
  isTop: boolean;
  /** Parent uses this to animate the card away imperatively (button swipes) */
  onXReady?: (x: MotionValue<number>) => void;
}

function SwipeCard({ profile, onSwipe, isTop, onXReady }: SwipeCardProps) {
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-28, 28]);
  const opacity = useTransform(x, [-220, -120, 0, 120, 220], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const hasPhotos = profile.photos.length > 0;
  const safeIndex = hasPhotos ? Math.max(0, Math.min(currentPhoto, profile.photos.length - 1)) : 0;

  // Expose x to parent so buttons can animate this card away
  useEffect(() => {
    if (isTop && onXReady) onXReady(x);
  }, [isTop, onXReady, x]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (!isTop) return;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    // Swipe if dragged far enough OR flicked fast enough
    if (offset > 100 || (offset > 40 && velocity > 400)) {
      // Wait for exit animation to finish before removing card from DOM
      animate(x, 700, { duration: 0.22 }).then(() => onSwipe("right"));
    } else if (offset < -100 || (offset < -40 && velocity < -400)) {
      animate(x, -700, { duration: 0.22 }).then(() => onSwipe("left"));
    } else {
      // Not far enough — snap back with spring
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <motion.div
      drag={isTop ? "x" : false}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity, scale: isTop ? 1 : 0.94, y: isTop ? 0 : 16 }}
      whileDrag={{ scale: 1.02 }}
      className={`absolute inset-0 ${isTop ? "cursor-grab active:cursor-grabbing z-10" : "pointer-events-none z-0"}`}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
        {/* Full-size photo background */}
        {hasPhotos ? (
          <img
            src={resolveMediaUrl(profile.photos[safeIndex])}
            alt={profile.name}
            className="absolute inset-0 w-full h-full object-cover select-none"
            draggable={false}
          />
        ) : (
          <PhotoPlaceholder name={profile.name} className="absolute inset-0 w-full h-full" />
        )}

        {/* Photo tap navigation zones — only on top card */}
        {isTop && hasPhotos && profile.photos.length > 1 && (
          <div className="absolute inset-0 flex z-10">
            <button className="flex-1" onClick={() => setCurrentPhoto(Math.max(0, safeIndex - 1))} />
            <button className="flex-1" onClick={() => setCurrentPhoto(Math.min(profile.photos.length - 1, safeIndex + 1))} />
          </div>
        )}

        {/* Photo progress indicators — only on top card */}
        {isTop && hasPhotos && profile.photos.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex gap-1 px-3 z-20 pointer-events-none">
            {profile.photos.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-all ${i === safeIndex ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}

        {/* Verified badge — only on top card */}
        {isTop && profile.is_verified === 1 && (
          <div className="absolute top-5 left-4 z-20">
            <div className="bg-gradient-to-r from-secondary to-[#FFD700] p-0.5 rounded-full">
              <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 text-secondary fill-secondary" />
                <span className="text-xs font-bold text-secondary">VERIFICADO</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom gradient — only on top card */}
        {isTop && (
          <div className="absolute bottom-0 left-0 right-0 h-3/5 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-10" />
        )}

        {/* Interests tags — only on top card */}
        {isTop && profile.interests && profile.interests.length > 0 && (
          <div className="absolute bottom-32 left-0 right-0 px-4 flex flex-wrap gap-1.5 pointer-events-none z-20">
            {profile.interests.slice(0, 3).map((interest) => (
              <span
                key={interest}
                className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30"
              >
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Info overlay — only on top card */}
        {isTop && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pointer-events-none z-20">
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="text-[clamp(1.6rem,5vw,2rem)] font-black text-white drop-shadow-lg leading-tight">{profile.name}</h2>
            <span className="text-2xl font-black text-white/90">{profile.age}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white/90">
              <MapPin className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
              <span className="font-medium text-sm">{profile.location}</span>
            </div>
            {profile.work && (
              <div className="flex items-center gap-2 text-white/80">
                <Briefcase className="w-3.5 h-3.5 text-secondary/80 flex-shrink-0" />
                <span className="font-medium text-sm">{profile.work}</span>
              </div>
            )}
          </div>
          {profile.bio && (
            <p className="text-white/80 text-sm mt-2 line-clamp-2 leading-relaxed">{profile.bio}</p>
          )}
        </div>
        )}

        {/* GOSTEI overlay */}
        <motion.div style={{ opacity: likeOpacity }}
          className="absolute top-16 right-5 z-30 bg-gradient-to-br from-secondary via-[#FFD700] to-secondary p-1 rounded-2xl rotate-12 shadow-2xl pointer-events-none">
          <div className="bg-black px-6 py-3 rounded-2xl">
            <span className="text-secondary font-black text-xl drop-shadow-lg">GOSTEI</span>
          </div>
        </motion.div>

        {/* NOPE overlay */}
        <motion.div style={{ opacity: nopeOpacity }}
          className="absolute top-16 left-5 z-30 bg-gradient-to-br from-[#CE1126] to-[#8B0000] p-1 rounded-2xl -rotate-12 shadow-2xl pointer-events-none">
          <div className="bg-black px-6 py-3 rounded-2xl">
            <span className="text-[#CE1126] font-black text-xl drop-shadow-lg">NOPE</span>
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
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ageRange: [18, 99], distance: 150, showVerifiedOnly: false, gender: "all", useGps: false });
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [superLikesLeft, setSuperLikesLeft] = useState(() => getSuperLikesInitial());
  const [boostActive, setBoostActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Swipe locking to prevent double-swipes
  const swipingRef = useRef(false);
  // x MotionValue of the top card — used to animate it away from buttons
  const topCardXRef = useRef<MotionValue<number> | null>(null);

  useEffect(() => {
    notificationsApi.getOnlineCount().then((r) => setOnlineCount(r.count)).catch(() => {});
  }, []);

  const loadProfiles = (f: Filters, coords?: { lat: number; lon: number } | null) => {
    setLoading(true);
    topCardXRef.current = null;
    const activeCoords = coords !== undefined ? coords : gpsCoords;
    profilesApi.discover({
      min_age: f.ageRange[0],
      max_age: f.ageRange[1],
      gender: f.gender,
      verified_only: f.showVerifiedOnly,
      ...(f.useGps && activeCoords ? { lat: activeCoords.lat, lon: activeCoords.lon, max_distance_km: f.distance } : {}),
    })
      .then((p) => { setProfiles(p); setCurrentIndex(0); setHistory([]); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    loadProfiles(filters);
  }, [isLoggedIn]);

  // Real-time: when a new user registers, silently fetch updated profiles and append new ones
  useEffect(() => {
    const handler = () => {
      profilesApi.discover({
        min_age: filters.ageRange[0],
        max_age: filters.ageRange[1],
        gender: filters.passportProvince ? "all" : filters.gender,
        verified_only: filters.showVerifiedOnly,
        ...(filters.useGps && gpsCoords ? { lat: gpsCoords.lat, lon: gpsCoords.lon, max_distance_km: filters.distance } : {}),
      }).then((fresh) => {
        setProfiles((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = fresh.filter((p) => !existingIds.has(p.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });
      }).catch(() => {});
    };
    window.addEventListener("angotinder:new_user", handler);
    return () => window.removeEventListener("angotinder:new_user", handler);
  }, [filters]);

  /** Core swipe logic — called AFTER the card has already animated off-screen */
  const processSwipe = useCallback(async (profile: UserType, dir: "left" | "right" | "super") => {
    setHistory((h) => [...h, profile]);
    setCurrentIndex((i) => i + 1);
    try {
      const res = await matchesApi.swipe(profile.id, dir);
      if (res.is_match && res.match_id) {
        setMatchedProfile(profile);
        setMatchId(res.match_id);
        setShowMatch(true);
        window.dispatchEvent(new Event("angotinder:new_match"));
      }
    } catch { /* offline — swipe still recorded locally */ }
  }, []);

  /** Called by the card after its drag animation completes (card is already off-screen) */
  const onCardSwiped = useCallback((dir: "left" | "right") => {
    if (swipingRef.current) return;
    const profile = profiles[currentIndex];
    if (!profile) return;
    swipingRef.current = true;
    processSwipe(profile, dir).finally(() => { swipingRef.current = false; });
  }, [profiles, currentIndex, processSwipe]);

  /** Called by action buttons — animates card away first, then processes swipe */
  const handleButtonSwipe = useCallback(async (dir: "left" | "right" | "super") => {
    if (swipingRef.current) return;
    const profile = profiles[currentIndex];
    if (!profile) return;
    swipingRef.current = true;

    const xVal = topCardXRef.current;
    if (xVal) {
      const target = (dir === "right" || dir === "super") ? 700 : -700;
      await animate(xVal, target, { duration: 0.25 });
    }

    await processSwipe(profile, dir === "super" ? "super" : dir);
    swipingRef.current = false;
  }, [profiles, currentIndex, processSwipe]);

  const handleRewind = () => {
    if (swipingRef.current || history.length === 0 || currentIndex === 0) return;
    topCardXRef.current = null;
    setHistory((h) => h.slice(0, -1));
    setCurrentIndex((i) => i - 1);
  };

  const registerTopCardX = useCallback((x: MotionValue<number>) => {
    topCardXRef.current = x;
  }, []);

  if (!isLoggedIn) return null;

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-20 h-20 text-secondary fill-secondary animate-pulse mx-auto mb-4" />
          <p className="text-white font-bold text-xl">A carregar perfis...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= profiles.length && !loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex flex-col relative overflow-hidden">
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
            <p className="text-white/70 mb-8 text-lg">Recarrega para ver mais pessoas 🔥</p>
            <Button onClick={() => loadProfiles(filters)}
              className="bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black text-lg px-8 py-6 rounded-2xl shadow-xl">
              Recarregar
            </Button>
            <Button
              disabled={resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  await profilesApi.resetSwipes();
                  loadProfiles(filters);
                } catch { /* ignore */ } finally {
                  setResetting(false);
                }
              }}
              className="mt-4 bg-white/10 text-white hover:bg-white/20 font-bold text-base px-8 py-4 rounded-2xl border border-white/20">
              {resetting ? "A limpar..." : "Recomeçar do zero"}
            </Button>
          </div>
        </div>
        <BottomNav navigate={navigate} active="discover" />
      </div>
    );
  }

  // Render the next 2 cards; reversed so the current card is on top (higher z)
  const visibleProfiles = [...profiles.slice(currentIndex, currentIndex + 2)].reverse();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] flex flex-col relative overflow-hidden">
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
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground font-bold">{boostActive ? "BOOST ATIVO 🔥" : onlineCount > 0 ? `${onlineCount} online` : "ONLINE"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(true)} className="p-3 hover:bg-secondary/10 rounded-2xl transition-colors">
            <Sliders className="w-6 h-6 text-primary" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-40 max-w-md mx-auto w-full relative z-10">
        <div className="card-stack relative h-full min-h-[480px]">
          {visibleProfiles.map((profile, revIdx) => {
            const isTop = revIdx === visibleProfiles.length - 1;
            return (
              <SwipeCard
                key={profile.id}
                profile={profile}
                onSwipe={onCardSwiped}
                isTop={isTop}
                onXReady={isTop ? registerTopCardX : undefined}
              />
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-32 left-0 right-0 px-2 sm:px-6 z-20">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 sm:gap-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleRewind}
            disabled={history.length === 0}
            title="Voltar ao perfil anterior"
            aria-label="Voltar"
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-secondary/30 hover:border-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw className="w-5 h-5 sm:w-7 sm:h-7 text-secondary" strokeWidth={2.5} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe("left")}
            title="Não curtir (Nope)"
            aria-label="Não curtir"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-[#CE1126]/30 hover:border-[#CE1126] transition-all">
            <X className="w-8 h-8 sm:w-10 sm:h-10 text-[#CE1126]" strokeWidth={3} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonSwipe("right")}
            title="Curtir"
            aria-label="Curtir"
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] shadow-2xl shadow-secondary/50 flex items-center justify-center">
            <div className="absolute inset-0 bg-secondary rounded-full blur-xl opacity-50 animate-pulse"></div>
            <Heart className="relative w-10 h-10 sm:w-12 sm:h-12 text-black fill-black drop-shadow-lg" strokeWidth={2.5} />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (superLikesLeft > 0) {
                setSuperLikesLeft((n) => { saveSuperLikes(n - 1); return n - 1; });
                handleButtonSwipe("super");
              }
            }}
            disabled={superLikesLeft === 0}
            title={superLikesLeft > 0 ? `Super Like (${superLikesLeft} restantes)` : "Sem Super Likes disponíveis"}
            aria-label="Super Like"
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#00C9FF] to-[#0080FF] shadow-2xl flex items-center justify-center border-4 border-blue-300/50 hover:border-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Star className="w-7 h-7 sm:w-9 sm:h-9 text-white fill-white" strokeWidth={2.5} />
            <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-secondary to-[#FFD700] rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs font-black text-black">{superLikesLeft}</span>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { setBoostActive(true); setTimeout(() => setBoostActive(false), 1800000); }}
            title={boostActive ? "Boost ativo — o teu perfil está em destaque!" : "Ativar Boost — destaca o teu perfil por 30 min"}
            aria-label="Boost"
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-xl flex items-center justify-center border-4 transition-all ${boostActive ? "bg-gradient-to-br from-secondary to-[#FFD700] border-secondary/50" : "bg-white border-purple-300 hover:border-purple-500"}`}>
            <Zap className={`w-5 h-5 sm:w-7 sm:h-7 ${boostActive ? "text-black fill-black" : "text-purple-600 fill-purple-600"}`} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>

      <BottomNav navigate={navigate} active="discover" />

      <MatchModal
        isOpen={showMatch}
        onClose={() => setShowMatch(false)}
        onSendMessage={() => {
          setShowMatch(false);
          navigate("/chat", {
            state: {
              matchId,
              matchedProfile: matchedProfile ? {
                id: matchedProfile.id,
                name: matchedProfile.name,
                photos: matchedProfile.photos,
                age: matchedProfile.age,
                location: matchedProfile.location,
              } : null,
            },
          });
        }}
        matchedProfile={{ name: matchedProfile?.name || "", photo: resolveMediaUrl(matchedProfile?.photos[0] || "") }}
        userPhoto={resolveMediaUrl(currentUser?.photos[0] || "")}
      />
      <FiltersModal
    isOpen={showFilters}
    onClose={() => setShowFilters(false)}
    onApply={(f, coords) => {
      setFilters(f);
      if (coords) setGpsCoords(coords);
      loadProfiles(f, coords);
    }}
    initial={filters}
  />
    </div>
  );
}

function BottomNav({ navigate, active }: { navigate: (path: string) => void; active: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
        <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={active === "discover"} />
        <NavBtn icon={<Heart className="w-6 h-6 fill-current" />} label="Likes" onClick={() => navigate("/likes")} active={active === "likes"} />
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
