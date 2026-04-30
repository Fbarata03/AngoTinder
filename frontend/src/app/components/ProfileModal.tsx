import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, X, MapPin, Briefcase, GraduationCap, Home, Star, ChevronLeft, ChevronRight, Flag, ShieldOff, AlertTriangle, UserPlus, UserMinus, Users } from "lucide-react";
import { resolveMediaUrl, User as UserType, safetyApi, socialApi } from "../api";
import { useApp } from "../context";

interface ProfileModalProps {
  profile: UserType | null;
  onClose: () => void;
  onLike?: () => void;
  onPass?: () => void;
  likeLabel?: string;
  onBlocked?: (userId: string) => void;
  showFollow?: boolean;
  onFollowChanged?: (targetId: string, nowFollowing: boolean) => void;
}

const REPORT_OPTIONS = [
  { value: "fake", label: "Perfil falso" },
  { value: "spam", label: "Spam ou publicidade" },
  { value: "inappropriate", label: "Conteúdo inapropriado" },
  { value: "harassment", label: "Assédio ou ameaças" },
  { value: "underage", label: "Menor de idade" },
  { value: "other", label: "Outro motivo" },
];

export function ProfileModal({
  profile,
  onClose,
  onLike,
  onPass,
  likeLabel = "Dar Like",
  onBlocked,
  showFollow = false,
  onFollowChanged,
}: ProfileModalProps) {
  const { userId: currentUserId } = useApp();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyDone, setSafetyDone] = useState<string | null>(null);

  // Social state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = profile?.id === currentUserId;
  const showFollowBtn = showFollow && !isOwnProfile && !!profile;

  useEffect(() => {
    setPhotoIdx(0);
    setStatsLoaded(false);
    setIsFollowing(false);
    setFollowers(0);
    setFollowing(0);
  }, [profile?.id]);

  useEffect(() => {
    if (!showFollowBtn || statsLoaded) return;
    socialApi.getStats(profile!.id)
      .then((s) => {
        setIsFollowing(s.is_following);
        setFollowers(s.followers);
        setFollowing(s.following);
        setStatsLoaded(true);
      })
      .catch(() => setStatsLoaded(true));
  }, [showFollowBtn, statsLoaded, profile]);

  const handleFollowToggle = async () => {
    if (followLoading || !profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await socialApi.unfollow(profile.id);
        setIsFollowing(false);
        setFollowers((n) => Math.max(0, n - 1));
        onFollowChanged?.(profile.id, false);
      } else {
        const res = await socialApi.follow(profile.id);
        setIsFollowing(true);
        setFollowers((n) => n + 1);
        onFollowChanged?.(profile.id, true);
        if (res.is_match) {
          // Match created → close modal and navigate to chat is handled by NotificationProvider
        }
      }
    } catch { /* ignore */ } finally {
      setFollowLoading(false);
    }
  };

  if (!profile) return null;

  const colors = ["#CE1126", "#8B0000", "#D4A017", "#006400"];
  const bg = colors[profile.name.charCodeAt(0) % colors.length];
  const photos = profile.photos;
  const safeIdx = photos.length > 0 ? Math.min(photoIdx, photos.length - 1) : 0;

  const handleBlock = async () => {
    setSafetyLoading(true);
    try {
      await safetyApi.block(profile.id);
      setSafetyDone("Utilizador bloqueado. Não vai aparecer mais.");
      onBlocked?.(profile.id);
      setTimeout(() => { setSafetyDone(null); setShowSafetyMenu(false); onClose(); }, 2000);
    } catch {
      setSafetyDone("Erro ao bloquear. Tente novamente.");
    } finally {
      setSafetyLoading(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    setSafetyLoading(true);
    try {
      await safetyApi.report(profile.id, reportReason, reportDetails);
      setSafetyDone("Denúncia enviada. Obrigado por nos ajudar a manter a comunidade segura.");
      onBlocked?.(profile.id);
      setTimeout(() => { setSafetyDone(null); setShowReportForm(false); setShowSafetyMenu(false); onClose(); }, 2500);
    } catch {
      setSafetyDone("Erro ao enviar denúncia. Tente novamente.");
    } finally {
      setSafetyLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full max-w-md max-h-[92dvh] bg-card rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Photo header */}
          <div className="relative w-full aspect-[4/5] flex-shrink-0">
            {photos.length > 0 ? (
              <img
                src={resolveMediaUrl(photos[safeIdx])}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white" style={{ backgroundColor: bg }}>
                {profile.name[0].toUpperCase()}
              </div>
            )}

            {photos.length > 1 && (
              <div className="absolute top-3 left-0 right-0 flex gap-1 px-3">
                {photos.map((_, i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i === safeIdx ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            )}

            {photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(Math.max(0, safeIdx - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button onClick={() => setPhotoIdx(Math.min(photos.length - 1, safeIdx + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </>
            )}

            {profile.is_verified === 1 && (
              <div className="absolute top-4 left-4">
                <div className="bg-gradient-to-r from-secondary to-[#FFD700] p-0.5 rounded-full">
                  <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 text-secondary fill-secondary" />
                    <span className="text-xs font-black text-secondary">VERIFICADO</span>
                  </div>
                </div>
              </div>
            )}

            <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>

            {!isOwnProfile && (
              <button
                onClick={() => setShowSafetyMenu(!showSafetyMenu)}
                className="absolute top-4 right-16 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                title="Denunciar ou bloquear"
              >
                <Flag className="w-4 h-4 text-white" />
              </button>
            )}

            {/* Safety dropdown */}
            <AnimatePresence>
              {showSafetyMenu && !showReportForm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-16 right-4 bg-card rounded-2xl shadow-2xl border border-black/10 overflow-hidden z-10 min-w-[180px]"
                >
                  {safetyDone ? (
                    <div className="p-4 text-sm font-bold text-center">{safetyDone}</div>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowReportForm(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-bold text-red-500">Denunciar</span>
                      </button>
                      <div className="border-t border-black/5" />
                      <button
                        onClick={handleBlock}
                        disabled={safetyLoading}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                      >
                        <ShieldOff className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold">Bloquear</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {showReportForm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-16 right-4 left-4 bg-card rounded-2xl shadow-2xl border border-black/10 overflow-hidden z-10"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-black text-sm">Motivo da denúncia</p>
                      <button onClick={() => setShowReportForm(false)} className="text-muted-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {safetyDone ? (
                      <p className="text-sm font-bold text-center py-2">{safetyDone}</p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1.5 mb-3">
                          {REPORT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setReportReason(opt.value)}
                              className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                reportReason === opt.value ? "bg-red-500 text-white" : "hover:bg-red-50 dark:hover:bg-red-900/20"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reportDetails}
                          onChange={(e) => setReportDetails(e.target.value)}
                          placeholder="Detalhes adicionais (opcional)..."
                          className="w-full text-xs p-2 rounded-xl bg-muted border border-black/10 resize-none h-16 mb-3 font-medium"
                        />
                        <button
                          onClick={handleReport}
                          disabled={!reportReason || safetyLoading}
                          className="w-full py-2 bg-red-500 text-white rounded-xl text-sm font-black disabled:opacity-50 hover:bg-red-600 transition-colors"
                        >
                          {safetyLoading ? "A enviar..." : "Enviar Denúncia"}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pt-3 pb-28">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-2xl font-black">{profile.name}</h2>
              <span className="text-2xl font-bold text-muted-foreground">{profile.age}</span>
            </div>

            {/* Social stats */}
            {showFollowBtn && statsLoaded && (
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">
                    <span className="text-foreground font-black">{followers}</span> seguidores
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-xs font-bold">
                    <span className="text-foreground font-black">{following}</span> a seguir
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              {profile.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{profile.location}</span>
                </div>
              )}
              {profile.work && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{profile.work}</span>
                </div>
              )}
              {profile.education && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{profile.education}</span>
                </div>
              )}
              {profile.hometown && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Home className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{profile.hometown}</span>
                </div>
              )}
            </div>

            {profile.bio && (
              <div className="mb-4">
                <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
              </div>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2">Interesses</p>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <span key={interest} className="px-3 py-1.5 bg-secondary/15 text-primary rounded-xl text-xs font-bold border-2 border-secondary/30">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fixed action buttons */}
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-primary/10 px-5 py-4 flex gap-3">
            {onPass && (
              <button
                onClick={() => { onPass(); onClose(); }}
                className="flex-1 h-14 rounded-2xl border-4 border-black/10 dark:border-white/15 hover:border-primary/50 flex items-center justify-center gap-2 font-black transition-all"
              >
                <X className="w-5 h-5 text-primary/60" />
                <span className="text-primary/60">Passar</span>
              </button>
            )}
            {showFollowBtn && (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading || !statsLoaded}
                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg transition-all disabled:opacity-60 ${
                  isFollowing
                    ? "bg-white dark:bg-white/10 border-4 border-secondary/50 text-foreground hover:border-red-400"
                    : "bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black text-white hover:opacity-90"
                }`}
              >
                {followLoading ? (
                  <span className="text-sm">{isFollowing ? "A deixar..." : "A seguir..."}</span>
                ) : isFollowing ? (
                  <>
                    <UserMinus className="w-5 h-5" />
                    <span>Seguindo</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Seguir</span>
                  </>
                )}
              </button>
            )}
            {onLike && (
              <button
                onClick={() => { onLike(); onClose(); }}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-secondary to-[#FFD700] flex items-center justify-center gap-2 font-black shadow-lg hover:opacity-90 transition-all"
              >
                <Heart className="w-5 h-5 text-black fill-black" />
                <span className="text-black">{likeLabel}</span>
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
