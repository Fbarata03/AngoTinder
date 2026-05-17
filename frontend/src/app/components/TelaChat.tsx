import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import {
  Heart, User, MessageCircle, Send, ArrowLeft, Sparkles, Star,
  Phone, Video, PhoneOff, VideoOff, Mic, MicOff, PhoneCall, Trash2, ImageIcon,
  CheckCheck, Smile, X as XIcon, Play, Pause, Volume2, VolumeX, RefreshCw,
  Paperclip, FileText, Film,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate, useLocation } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "motion/react";
import { matchesApi, messagesApi, notificationsApi, createChatSocket, resolveMediaUrl, Match, Message } from "../api";
import { useApp } from "../context";

const TURN_URL = (import.meta as any).env?.VITE_TURN_URL as string | undefined;
const TURN_USERNAME = (import.meta as any).env?.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = (import.meta as any).env?.VITE_TURN_CREDENTIAL as string | undefined;

// Fallback grátis para melhorar chamadas sem servidor TURN próprio.
// Nota: pode ter limites, mas melhora bastante em redes móveis/NAT.
const PUBLIC_FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  ...PUBLIC_FALLBACK_ICE_SERVERS,
  ...(TURN_URL ? [{ urls: [TURN_URL], username: TURN_USERNAME, credential: TURN_CREDENTIAL }] : []),
];

type CallState = "idle" | "incoming" | "calling" | "connected";

const LAST_SEEN_KEY = "angotinder_last_seen_messages";

function loadLastSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeLastSeen(next: Record<string, string>) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
  } catch {
  }
}

function maxIso(a?: string, b?: string) {
  const da = a ? Date.parse(a) : 0;
  const db = b ? Date.parse(b) : 0;
  return db > da ? (b || a || "") : (a || b || "");
}

function markLastSeen(matchId: string, iso: string) {
  const prev = loadLastSeen();
  const next = { ...prev, [matchId]: maxIso(prev[matchId], iso) };
  writeLastSeen(next);
}

const QUICK_EMOJIS = ["😍", "❤️", "🔥", "😂", "😘", "👋", "💪", "🙏", "😊", "🥰", "😉", "💯", "🎉", "✨", "💕", "😎", "🤩", "😇", "🤗", "💋", "🌹", "💖", "👍", "🏆", "😅", "🤣", "😋", "🥳", "🫶", "💃"];

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function isSameGroup(msg: Message, prev: Message): boolean {
  if (prev.sender_id !== msg.sender_id) return false;
  return Date.parse(msg.created_at) - Date.parse(prev.created_at) < 2 * 60 * 1000;
}

const WAVEFORM_HEIGHTS = [3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 6, 8, 5, 7, 9, 4, 6, 8, 5, 7, 4, 3, 5, 8, 6];

function VoiceMessage({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errored, setErrored] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => { });
  };

  if (errored) {
    return <p className="text-xs opacity-60 italic">Áudio expirado</p>;
  }

  return (
    <div className="flex items-center gap-2 min-w-[190px] max-w-[220px]">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setDuration(a.duration);
        }}
        onError={() => setErrored(true)}
        className="hidden"
      />
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isOwn ? "bg-white/25 hover:bg-white/35" : "bg-primary/15 hover:bg-primary/25"
          }`}
      >
        {playing
          ? <Pause className={`w-4 h-4 ${isOwn ? "text-white" : "text-primary"}`} />
          : <Play className={`w-4 h-4 ml-0.5 ${isOwn ? "text-white" : "text-primary"}`} />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-px h-6 mb-0.5">
          {WAVEFORM_HEIGHTS.map((h, i) => {
            const filled = progress > 0 && (i / WAVEFORM_HEIGHTS.length) <= progress;
            return (
              <div key={i} style={{ height: `${h * 1.9}px` }}
                className={`w-[2px] rounded-full transition-colors ${filled
                  ? isOwn ? "bg-white" : "bg-primary"
                  : isOwn ? "bg-white/30" : "bg-primary/25"
                  }`}
              />
            );
          })}
        </div>
        <p className="text-xs opacity-50 font-medium">
          {duration > 0
            ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")}`
            : "áudio"}
        </p>
      </div>
    </div>
  );
}

function VideoMessage({ src, isOwn }: { src: string; isOwn: boolean }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <p className="text-xs opacity-60 italic">Vídeo expirado</p>;
  return (
    <div className="max-w-[240px]">
      <video
        src={src}
        controls
        playsInline
        className="w-full max-h-[200px] rounded-xl bg-black"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

function DocMessage({ url, filename, isOwn }: { url: string; filename: string; isOwn: boolean }) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const extColor: Record<string, string> = {
    pdf: "bg-red-500", doc: "bg-blue-600", docx: "bg-blue-600",
    xls: "bg-green-600", xlsx: "bg-green-600", ppt: "bg-orange-500",
    pptx: "bg-orange-500", txt: "bg-gray-500", zip: "bg-yellow-600",
  };
  const color = extColor[ext] || "bg-gray-500";
  return (
    <a href={url} download={filename} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 min-w-[180px] max-w-[240px] hover:opacity-75 transition-opacity">
      <div className={`${color} w-10 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <span className="text-white text-xs font-black uppercase">{ext.slice(0, 4) || "DOC"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isOwn ? "text-white" : "text-foreground"}`}>{filename}</p>
        <p className={`text-xs mt-0.5 ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>Toque para abrir</p>
      </div>
    </a>
  );
}

function Avatar({ photo, name }: { photo?: string; name: string }) {
  const colors = ["#CE1126", "#8B0000", "#D4A017", "#006400"];
  const bg = colors[name.charCodeAt(0) % colors.length];
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (photo) {
    return <img src={resolveMediaUrl(photo)} alt={name} className="w-full h-full object-cover" />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-white" style={{ backgroundColor: bg }}>
      {initials || "?"}
    </div>
  );
}
// âââ Chat List ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function formatLastMessage(text: string): string {
  if (!text) return "";
  if (text.startsWith("img:")) return "📷 Imagem";
  if (text.startsWith("aud:")) return "🎵 Áudio";
  if (text.startsWith("vid:")) return "🎬 Vídeo";
  if (text.startsWith("doc:")) {
    const rest = text.slice(4);
    const pipeIdx = rest.indexOf("|");
    return `📄 ${pipeIdx >= 0 ? rest.slice(pipeIdx + 1) : "Documento"}`;
  }
  return text;
}

function ChatList({ onSelectMatch, autoOpenMatchId, selectedMatchId, hideMobileNav }: { onSelectMatch: (m: Match) => void; autoOpenMatchId?: string; selectedMatchId?: string; hideMobileNav?: boolean }) {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const autoOpenedRef = useRef(false);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(() => loadLastSeen());
  const [onlineCount, setOnlineCount] = useState(0);
  const [unmatching, setUnmatching] = useState<string | null>(null);
  const [viewProfileMatch, setViewProfileMatch] = useState<Match | null>(null);

  const setSeen = useCallback((matchId: string, iso: string) => {
    setLastSeen((prev) => {
      const next = { ...prev, [matchId]: maxIso(prev[matchId], iso) };
      writeLastSeen(next);
      return next;
    });
  }, []);

  const isUnread = useCallback((m: Match) => {
    if (!m.last_message_at) return false;
    const last = Date.parse(m.last_message_at);
    const seen = lastSeen[m.match_id] ? Date.parse(lastSeen[m.match_id]) : 0;
    return last > seen;
  }, [lastSeen]);

  const unreadCount = matches.reduce((acc, m) => acc + (isUnread(m) ? 1 : 0), 0);

  const loadMatches = useCallback(() => {
    if (!isLoggedIn) return;
    matchesApi.getMatches()
      .then((m) => {
        setMatches(m);
        setLoading(false);
        // Auto-abrir conversa se veio de um match (só uma vez)
        if (autoOpenMatchId && !autoOpenedRef.current) {
          const found = m.find((x) => x.match_id === autoOpenMatchId);
          if (found) {
            autoOpenedRef.current = true;
            if (found.last_message_at) setSeen(found.match_id, found.last_message_at);
            onSelectMatch(found);
          }
        }
      })
      .catch(() => setLoading(false));
  }, [isLoggedIn, autoOpenMatchId, onSelectMatch, setSeen]);

  useEffect(() => {
    notificationsApi.getOnlineCount().then((r) => setOnlineCount(r.count)).catch(() => { });
    const onlineInterval = setInterval(() => {
      notificationsApi.getOnlineCount().then((r) => setOnlineCount(r.count)).catch(() => { });
    }, 30000);
    return () => clearInterval(onlineInterval);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    loadMatches();
    // Safety-net poll every 30s — WebSocket handles real-time updates
    const interval = setInterval(loadMatches, 30000);
    // Also refresh when tab becomes visible again
    const onVisible = () => { if (document.visibilityState === "visible") loadMatches(); };
    document.addEventListener("visibilitychange", onVisible);
    // Listen for new_match events from NotificationProvider
    const onNewMatch = () => loadMatches();
    const onNewMessage = () => loadMatches();
    window.addEventListener("angotinder:new_match", onNewMatch);
    window.addEventListener("angotinder:new_message", onNewMessage);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("angotinder:new_match", onNewMatch);
      window.removeEventListener("angotinder:new_message", onNewMessage);
    };
  }, [isLoggedIn, loadMatches]);

  return (
    <div className="h-full bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] flex flex-col relative overflow-hidden">
      <AfricanPattern className="absolute top-0 left-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 right-0 w-96 h-96 text-secondary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <MessageCircle className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black">Matches</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <p className="text-secondary font-bold">{matches.length} {matches.length === 1 ? "conversa" : "conversas"}</p>
            </div>
            {onlineCount > 0 && (
              <div className="flex items-center gap-1.5 bg-green-500/20 px-2 py-0.5 rounded-full border border-green-400/40">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-300 text-xs font-black">{onlineCount} online</span>
              </div>
            )}
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-black text-xs font-black animate-pulse">
                {unreadCount} nova{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {matches.some((m) => !m.last_message) && (
        <div className="p-4 border-b-4 border-secondary/30 bg-card/50 backdrop-blur-sm relative z-10 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-black text-sm mb-3 flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4 text-secondary" /> Novos Matches
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {matches.filter((m) => !m.last_message).map((m, i) => (
                <motion.button key={m.match_id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => { onSelectMatch(m); }}
                  className="flex-shrink-0 text-center">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${selectedMatchId === m.match_id ? "border-secondary" : "border-secondary/60"} shadow-lg`}>
                      <Avatar photo={m.photos[0]} name={m.name} />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-primary to-[#8B0000] rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <Heart className="w-2.5 h-2.5 text-white fill-white" />
                    </div>
                  </div>
                  <p className="text-xs mt-1.5 max-w-[64px] truncate font-bold text-foreground">{m.name}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto relative z-10 ${hideMobileNav ? "pb-4" : "pb-28 md:pb-4"}`}>
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="text-center py-16">
              <Heart className="w-16 h-16 text-primary animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">A carregar matches...</p>
            </div>
          )}
          {!loading && matches.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-16 h-16 text-primary" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2">Nenhum match ainda</h3>
              <p className="text-muted-foreground font-medium">Continue a descobrir pessoas!</p>
              <Button onClick={() => navigate("/discover")}
                className="mt-6 bg-gradient-to-r from-primary to-[#8B0000] text-white font-black rounded-2xl px-8 py-3">
                Descobrir Perfis
              </Button>
            </div>
          )}
          {!loading && matches.length > 0 && !matches.some((m) => !!m.last_message) && (
            <div className="text-center py-10 px-6">
              <MessageCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-medium">Clica num match acima para começar a falar!</p>
            </div>
          )}
          {matches.filter((m) => !!m.last_message).map((m, i) => (
            <motion.div key={m.match_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`border-b border-primary/10 flex items-center group ${selectedMatchId === m.match_id ? "bg-secondary/10 border-l-4 border-l-secondary" : ""}`}>
              <button
                onClick={() => { if (m.last_message_at) setSeen(m.match_id, m.last_message_at); onSelectMatch(m); }}
                className="flex-1 p-4 hover:bg-card/70 transition-all flex items-center gap-4 text-left">
                <div className="relative flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); setViewProfileMatch(m); }}>
                  <div className="w-14 h-14 rounded-full overflow-hidden border-4 border-secondary/50 group-hover:border-secondary transition-all shadow-md cursor-pointer hover:opacity-80">
                    <Avatar photo={m.photos[0]} name={m.name} />
                  </div>
                  {m.is_verified === 1 && <Star className="absolute -top-1 -right-1 w-4 h-4 text-secondary fill-secondary drop-shadow-lg" />}
                  {isUnread(m) && (
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-secondary rounded-full border-2 border-white shadow-lg animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black truncate text-lg flex items-center gap-2">
                      {m.name}
                      {isUnread(m) && <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />}
                    </h3>
                    {m.last_message_at && (
                      <span className="text-xs text-muted-foreground font-bold">
                        {new Date(m.last_message_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${isUnread(m) ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                    {m.last_message ? formatLastMessage(m.last_message) : "Diga olá! 👋"}
                  </p>
                </div>
              </button>
              <button
                disabled={unmatching === m.match_id}
                onClick={async () => {
                  if (!confirm(`Eliminar conversa com ${m.name}?`)) return;
                  setUnmatching(m.match_id);
                  try {
                    await matchesApi.unmatch(m.match_id);
                    setMatches((prev) => prev.filter((x) => x.match_id !== m.match_id));
                  } catch { /* ignore */ } finally { setUnmatching(null); }
                }}
                className="pr-5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Eliminar conversa">
                <Trash2 className={`w-5 h-5 ${unmatching === m.match_id ? "text-muted-foreground animate-pulse" : "text-red-400 hover:text-red-600"}`} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {!hideMobileNav && (
        <div className="md:hidden">
          <BottomNav active="chat" />
        </div>
      )}
      {viewProfileMatch && (
        <ProfileModal open={true} onClose={() => setViewProfileMatch(null)} match={viewProfileMatch} />
      )}
    </div>
  );
}

// âââ Chat Conversation with Voice/Video Calls âââââââââââââââââââââââââââââ
function ChatConversation({ match, onBack }: { match: Match; onBack: () => void }) {
  const { userId } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedOlderRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsPingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myTypingRef = useRef(false);
  const [showProfile, setShowProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readUntilId, setReadUntilId] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<number>>(() => new Set());
  const showSendError = (msg: string) => {
    setSendError(msg);
    if (sendErrorTimerRef.current) clearTimeout(sendErrorTimerRef.current);
    sendErrorTimerRef.current = setTimeout(() => setSendError(null), 5000);
  };
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartingRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRecordingRef = useRef(false);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facingFront, setFacingFront] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  // streamTick: incrementado sempre que local ou remote stream mudam â dispara re-aplicação
  const [streamTick, setStreamTick] = useState(0);
  const bumpStream = useCallback(() => setStreamTick((n) => n + 1), []);

  const callStateRef = useRef<CallState>("idle");
  const callTypeRef = useRef<"audio" | "video">("audio");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // Refs simples â os elementos estão sempre no DOM (hidden via CSS)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const turnCacheRef = useRef<{ exp: number; server: RTCIceServer } | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`angotinder_hidden_msgs_${match.match_id}`) || "[]";
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setHiddenMsgIds(new Set(arr.filter((x) => typeof x === "number")));
      else setHiddenMsgIds(new Set());
    } catch {
      setHiddenMsgIds(new Set());
    }
  }, [match.match_id]);

  // Aplicação central de streams â dispara quando qualquer dependência muda,
  // com retries (200ms e 900ms) para cobrir timing issues em iOS/Safari/Firefox
  useEffect(() => {
    const apply = () => {
      // Vídeo local (sempre muted â evita eco)
      if (localStreamRef.current && localVideoRef.current) {
        if (localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        localVideoRef.current.play().catch(() => { });
      }
      // Stream remoto
      const remote = remoteStreamRef.current;
      if (callType === "video") {
        if (remote && remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remote) {
            remoteVideoRef.current.srcObject = remote;
          }
          remoteVideoRef.current.play().catch(() => { });
        }
        // Evitar eco: limpar elemento de áudio em chamadas de vídeo
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      } else {
        if (remote && remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== remote) {
            remoteAudioRef.current.srcObject = remote;
          }
          remoteAudioRef.current.play().catch(() => { });
        }
      }
    };
    apply();
    const t1 = setTimeout(apply, 200);
    const t2 = setTimeout(apply, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [streamTick, callState, callType]);

  useEffect(() => {
    messagesApi.getMessages(match.match_id, 120)
      .then((m) => {
        setMessages(m);
        setHasMore(m.length >= 120);
        setLoading(false);
        const last = m.length ? m[m.length - 1].created_at : null;
        if (last) markLastSeen(match.match_id, last);
      })
      .catch(() => setLoading(false));
  }, [match.match_id]);

  useEffect(() => {
    if (connected) return;
    let active = true;
    const t = setInterval(() => {
      messagesApi.getMessages(match.match_id)
        .then((m) => {
          if (!active) return;
          setMessages((prev) => {
            if (!prev.length) return m;
            const byId = new Map(prev.map((x) => [x.id, x]));
            for (const x of m) byId.set(x.id, x);
            return Array.from(byId.values()).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
          });
          const last = m.length ? m[m.length - 1].created_at : null;
          if (last) markLastSeen(match.match_id, last);
        })
        .catch(() => { /* ignore */ });
    }, 4000);
    return () => { active = false; clearInterval(t); };
  }, [connected, match.match_id]);

  const sendSignal = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const endCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallState("idle");
    setCallDuration(0);
    setMuted(false);
    setVideoOff(false);
  }, []);

  const getTurnIceServer = useCallback(async (): Promise<RTCIceServer | null> => {
    const cached = turnCacheRef.current;
    const now = Date.now();
    if (cached && cached.exp > now + 10_000) return cached.server;
    try {
      const creds = await messagesApi.getTurnCredentials();
      const server: RTCIceServer = { urls: creds.urls, username: creds.username, credential: creds.credential };
      turnCacheRef.current = { exp: now + Math.max(60, creds.ttl) * 1000, server };
      return server;
    } catch {
      return null;
    }
  }, []);

  const createPC = useCallback(async (): Promise<RTCPeerConnection> => {
    const turn = await getTurnIceServer();
    const pc = new RTCPeerConnection({ iceServers: turn ? [...DEFAULT_ICE_SERVERS, turn] : DEFAULT_ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: "ice-candidate", candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      // Alguns browsers (Firefox, Safari) podem não preencher e.streams
      const stream = e.streams[0] ?? (() => {
        const s = new MediaStream();
        if (e.track) s.addTrack(e.track);
        return s;
      })();
      remoteStreamRef.current = stream;
      // Disparar re-aplicação de streams (useEffect central com retries)
      bumpStream();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
        callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall();
      }
    };
    return pc;
  }, [sendSignal, endCall, getTurnIceServer, bumpStream]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      if (!active) return;
      const ws = createChatSocket(match.match_id);
      wsRef.current = ws;

      if (wsPingRef.current) { clearInterval(wsPingRef.current); wsPingRef.current = null; }
      ws.onopen = () => {
        if (!active) return;
        setConnected(true);
        wsPingRef.current = setInterval(() => {
          try {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
          } catch { /* ignore */ }
        }, 25000);
      };
      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        if (wsPingRef.current) { clearInterval(wsPingRef.current); wsPingRef.current = null; }
        // Auto-reconnect after 3 seconds
        reconnectTimer = setTimeout(() => { if (active) connect(); }, 3000);
      };
      ws.onerror = () => { ws.close(); };

      ws.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const type = payload.type as string;

          if (type === "message") {
            const data = payload.data as Message;
            setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
            markLastSeen(match.match_id, data.created_at);
            // The other person sent a message â they stopped typing
            setPeerTyping(false);
            return;
          }

          if (type === "message_reaction") {
            const msgId = payload.message_id as number;
            const rx = payload.reaction as string | null;
            setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reaction: rx } : m));
            return;
          }

          if (type === "mark_read") {
            const lastId = (payload.last_id ?? payload.lastId) as number;
            if (lastId) setReadUntilId((prev) => Math.max(prev, lastId));
            return;
          }

          if (type === "message_deleted") {
            const msgId = payload.message_id as number;
            setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deleted: true } : m));
            return;
          }

          if (type === "typing") {
            setPeerTyping(true);
            return;
          }
          if (type === "typing-stop") {
            setPeerTyping(false);
            return;
          }

          if (type === "call-offer") {
            if (callStateRef.current !== "idle") {
              sendSignal({ type: "call-busy" });
              return;
            }
            setCallType((payload.callType as "audio" | "video") || "audio");
            pendingOfferRef.current = { type: "offer", sdp: payload.sdp as string };
            setCallState("incoming");
          }

          if (type === "call-answer" && pcRef.current) {
            await pcRef.current.setRemoteDescription({ type: "answer", sdp: payload.sdp as string });
          }

          if (type === "ice-candidate") {
            const candidate = payload.candidate as RTCIceCandidateInit;
            const pc = pcRef.current;
            if (!pc || !pc.remoteDescription) {
              pendingCandidatesRef.current.push(candidate);
              return;
            }
            try {
              await pc.addIceCandidate(candidate);
            } catch {
              pendingCandidatesRef.current.push(candidate);
            }
          }

          if (type === "call-end" || type === "call-reject") {
            endCall();
          }

          if (type === "call-busy") {
            endCall();
            alert("A outra pessoa já está em chamada.");
          }
        } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsPingRef.current) { clearInterval(wsPingRef.current); wsPingRef.current = null; }
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      wsRef.current?.close();
      endCall();
    };
  }, [match.match_id, endCall]);

  useEffect(() => {
    if (!showEmojis) return;
    const handler = (e: PointerEvent) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showEmojis]);


  // Emite mark_read sempre que há mensagens novas e o WS está ligado
  const lastMsgId = messages[messages.length - 1]?.id ?? 0;
  useEffect(() => {
    if (!connected || !lastMsgId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mark_read", last_id: lastMsgId }));
    }
  }, [connected, lastMsgId]);

  useEffect(() => {
    if (loadedOlderRef.current) { loadedOlderRef.current = false; return; }
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 160;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const startCall = async (type: "audio" | "video") => {
    if (callStateRef.current !== "idle") return;
    try {
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setCallType(type);
      setCallState("calling");
      bumpStream(); // Aplicar stream local imediatamente
      const pc = await createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
      await pc.setLocalDescription(offer);
      sendSignal({ type: "call-offer", sdp: offer.sdp, callType: type });
    } catch (err) {
      setCallState("idle");
      const msg = err instanceof Error && err.name === "NotAllowedError"
        ? "Permissão negada. Ativa o microfone/câmara nas definições do browser."
        : type === "video"
          ? "Não foi possível aceder à  câmara. Verifica as permissões."
          : "Não foi possível aceder ao microfone. Verifica as permissões.";
      alert(msg);
    }
  };

  const acceptCall = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setCallState("calling");
      bumpStream(); // Aplicar stream local imediatamente
      const pc = await createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(pendingOfferRef.current);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "call-answer", sdp: answer.sdp });
        for (const c of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(c); } catch { /* ok */ }
        }
        pendingCandidatesRef.current = [];
      }
    } catch {
      sendSignal({ type: "call-reject" });
      endCall();
      alert("Não foi possível aceder ao microfone/câmara. Verifica as permissões.");
    }
  };

  const rejectCall = () => {
    sendSignal({ type: "call-reject" });
    endCall();
  };

  const hangUp = () => {
    sendSignal({ type: "call-end" });
    endCall();
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = videoOff; });
    setVideoOff((v) => !v);
  };

  const toggleSpeaker = () => {
    const audio = remoteAudioRef.current;
    if (audio && "setSinkId" in HTMLMediaElement.prototype) {
      (audio as any).setSinkId(speakerOn ? "" : "default").catch(() => { });
    }
    setSpeakerOn((s) => !s);
  };

  const flipCamera = async () => {
    if (!localStreamRef.current || callType !== "video") return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    const newFacing = facingFront ? "environment" : "user";
    videoTrack.stop();
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);
      const audioTracks = localStreamRef.current.getAudioTracks();
      localStreamRef.current = new MediaStream([...audioTracks, newVideoTrack]);
      setFacingFront((f) => !f);
      bumpStream();
    } catch { /* sem câmara traseira ou permissão negada */ }
  };

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const MAX = { image: 10, video: 50, audio: 15, doc: 25 };

  const startLongPress = (msg: Message) => (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      setContextMsg(msg);
    }, 500);
  };
  const startLongPressTouch = (msg: Message) => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      setContextMsg(msg);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      return true;
    } catch {
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handleDeleteMessage = async () => {
    if (!contextMsg) return;
    const msg = contextMsg;
    setContextMsg(null);
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, deleted: true } : m));
    try {
      await messagesApi.deleteMessage(match.match_id, msg.id);
    } catch {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, deleted: false } : m));
      showSendError("Não foi possível apagar a mensagem.");
    }
  };

  const handleDeleteForMe = () => {
    if (!contextMsg) return;
    const id = contextMsg.id;
    setContextMsg(null);
    setHiddenMsgIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(`angotinder_hidden_msgs_${match.match_id}`, JSON.stringify(Array.from(next)));
      } catch {
      }
      return next;
    });
  };

  const sendViaWsOrApi = async (textStr: string) => {
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text: textStr, reply_to: replyId }));
    } else {
      const msg = await (messagesApi as any).sendMessage(match.match_id, textStr, replyId);
      setMessages((m) => [...m, msg]);
    }
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage.trim();
    setNewMessage("");
    setReplyingTo(null);
    myTypingRef.current = false;
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing-stop" }));
    }
    try {
      const msg = await messagesApi.sendMessage(match.match_id, text);
      setMessages((m) => [...m, msg]);
      await sendViaWsOrApi(text);
    } catch (err: any) {
      setNewMessage(text);
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    }
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 50);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX.image * 1024 * 1024) {
      showSendError(`Imagem demasiado grande. Máximo ${MAX.image} MB.`);
      e.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await messagesApi.uploadMedia(file, "image", 24);
      setNewMessage("");
      const msg = await messagesApi.sendMessage(match.match_id, res.text);
      setMessages((m) => [...m, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sendViaWsOrApi(res.text);
    } catch (err: any) {
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX.video * 1024 * 1024) {
      showSendError(`Vídeo demasiado grande. Máximo ${MAX.video} MB.`);
      e.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await messagesApi.uploadMedia(file, "video", 48);
      const msg = await messagesApi.sendMessage(match.match_id, res.text);
      setMessages((m) => [...m, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sendViaWsOrApi(res.text);
    } catch (err: any) {
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX.doc * 1024 * 1024) {
      showSendError(`Documento demasiado grande. Máximo ${MAX.doc} MB.`);
      e.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await messagesApi.uploadMedia(file, "doc", 168);
      const msg = await messagesApi.sendMessage(match.match_id, res.text);
      setMessages((m) => [...m, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sendViaWsOrApi(res.text);
    } catch (err: any) {
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const type = isVideo ? "video" : "image";
    const maxMB = isVideo ? MAX.video : MAX.image;
    if (file.size > maxMB * 1024 * 1024) {
      showSendError(`${isVideo ? "Vídeo" : "Imagem"} demasiado grande. Máximo ${maxMB} MB.`);
      e.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await messagesApi.uploadMedia(file, type, isVideo ? 48 : 24);
      const msg = await messagesApi.sendMessage(match.match_id, res.text);
      setMessages((m) => [...m, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sendViaWsOrApi(res.text);
    } catch (err: any) {
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleUploadAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX.audio * 1024 * 1024) {
      showSendError(`Áudio demasiado grande. Máximo ${MAX.audio} MB.`);
      e.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await messagesApi.uploadMedia(file, "audio", 24);
      const msg = await messagesApi.sendMessage(match.match_id, res.text);
      setMessages((m) => [...m, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sendViaWsOrApi(res.text);
    } catch (err: any) {
      showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const startRecording = async () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    if (recordingStartingRef.current) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      showSendError("O teu browser não suporta gravação de áudio.");
      return;
    }
    recordingStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelRecordingRef.current = false;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        setIsRecording(false);
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (recordingTimeRef.current < 1) {
          showSendError("Gravação demasiado curta.");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (chunksRef.current.length === 0) { stream.getTracks().forEach((t) => t.stop()); return; }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `voice.${ext}`, { type: mimeType });
        if (file.size > MAX.audio * 1024 * 1024) {
          showSendError(`Áudio demasiado grande. Máximo ${MAX.audio} MB.`);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setUploading(true);
        try {
          const res = await messagesApi.uploadMedia(file, "audio", 24);
          const msg = await messagesApi.sendMessage(match.match_id, res.text);
          setMessages((m) => [...m, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          await sendViaWsOrApi(res.text);
        } catch (err: any) {
          showSendError(err?.message?.includes("fetch") ? "Sem ligação. A tentar novamente..." : `Erro ao enviar: ${err?.message || "tenta de novo"}`);
        } finally {
          setUploading(false);
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      rec.start();
      recordingStartingRef.current = false;
    } catch {
      setIsRecording(false);
      recordingStartingRef.current = false;
      showSendError("Permita acesso ao microfone para gravar áudio.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const visibleMessages = messages.filter((m) => !hiddenMsgIds.has(m.id));

  return (
    <div className="h-full min-h-0 flex flex-col bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <AfricanPattern className="absolute inset-0 text-primary opacity-5 pointer-events-none" />

      {/* ââ Elementos de média SEMPRE no DOM para evitar timing issues ââ */}
      {/* O srcObject é gerido pelo useEffect central com retries */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {/* Vídeo local: mostrado no overlay quando em chamada de vídeo */}
      <video
        ref={localVideoRef}
        autoPlay playsInline muted
        className={`
          mirror object-cover
          ${callState !== "idle" && callType === "video"
            ? "absolute top-4 right-4 z-[60] w-24 h-32 sm:w-32 sm:h-44 md:w-40 md:h-52 rounded-2xl border-2 border-secondary shadow-2xl bg-gray-900"
            : "hidden"}
        `}
      />
      {/* Vídeo remoto: mostrado em full quando chamada de vídeo conectada */}
      <video
        ref={remoteVideoRef}
        autoPlay playsInline
        className={`
          object-cover
          ${callState === "connected" && callType === "video"
            ? "absolute inset-0 z-[55] w-full h-full"
            : "hidden"}
        `}
      />

      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-[#1a0000] px-6 py-4 text-white shadow-2xl z-10 flex-shrink-0 border-b-2 border-secondary/30">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {/* Botão voltar apenas no mobile */}
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-secondary shadow-xl flex-shrink-0 cursor-pointer ring-2 ring-secondary/50" onClick={() => setShowProfile(true)}>
            <Avatar photo={match.photos[0]} name={match.name} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-lg truncate">{match.name}</h2>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${connected ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
              <p className="text-xs font-bold transition-colors" style={{ color: connected ? "#86efac" : "rgba(255,255,255,0.35)" }}>
                {connected ? "Ligado" : "A reconectar..."}
              </p>
            </div>
          </div>
          <button onClick={() => startCall("audio")} disabled={callState !== "idle"}
            title="Chamada de voz"
            className="p-2.5 w-11 h-11 flex items-center justify-center bg-green-500 hover:bg-green-400 rounded-full transition-colors disabled:opacity-40 shadow-lg flex-shrink-0">
            <Phone className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => startCall("video")} disabled={callState !== "idle"}
            title="Chamada de vídeo"
            className="p-2.5 w-11 h-11 flex items-center justify-center bg-[#1e3a6e] hover:bg-[#1e4a8a] rounded-full transition-colors disabled:opacity-40 shadow-lg flex-shrink-0">
            <Video className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 relative z-10">
        <div className="max-w-4xl mx-auto space-y-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center py-4">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-secondary via-[#FFD700] to-secondary p-0.5 rounded-full shadow-xl">
              <div className="bg-black px-4 py-2 rounded-full flex items-center gap-2">
                <Heart className="w-4 h-4 fill-secondary text-secondary" />
                <span className="font-black text-secondary text-sm">Match com {match.name}!</span>
              </div>
            </div>
          </motion.div>

          {/* Quebra-gelos — só aparecem quando a conversa está vazia */}
          {!loading && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-2 px-2"
            >
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">💡 Quebra-gelos</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  `Olá ${match.name}! O que te trouxe ao AngoTinder? 😊`,
                  `Oi! Qual é o teu lugar favorito em Angola? 🌍`,
                  `Olá! Vi que tens interesses fixe. O que fazes nos fins de semana? ☀️`,
                  `${match.name}! Se pudesses viajar agora, para onde ias? ✈️`,
                  `Oi! Já fui ao match, agora preciso saber: qual é a tua música favorita? 🎵`,
                ].map((text) => (
                  <button
                    key={text}
                    onClick={() => {
                      setNewMessage(text);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="px-3 py-2 bg-white dark:bg-white/10 border-2 border-secondary/40 rounded-2xl text-xs font-bold text-left hover:border-secondary hover:bg-secondary/10 transition-all shadow-sm max-w-xs text-foreground/80"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {loading && <p className="text-center text-muted-foreground font-medium text-sm">A carregar mensagens...</p>}

          {hasMore && !loading && (
            <div className="text-center py-2">
              <button
                onClick={async () => {
                  if (loadingMore || !messages.length) return;
                  setLoadingMore(true);
                  try {
                    const older = await messagesApi.getMessages(match.match_id, 60, messages[0].id);
                    setHasMore(older.length >= 60);
                    loadedOlderRef.current = true;
                    setMessages((prev) => [...older, ...prev]);
                  } catch { /* ignore */ } finally { setLoadingMore(false); }
                }}
                disabled={loadingMore}
                className="text-xs text-muted-foreground hover:text-primary font-bold px-4 py-2 rounded-full hover:bg-primary/10 transition-all disabled:opacity-50"
              >
                {loadingMore ? "A carregar..." : "↑ Mensagens anteriores"}
              </button>
            </div>
          )}

          {visibleMessages.map((msg, idx) => {
            const t = msg.text || "";
            const isImg = t.startsWith("img:");
            const isAud = t.startsWith("aud:");
            const isVid = t.startsWith("vid:");
            const isDoc = t.startsWith("doc:");
            const isMedia = isImg || isAud || isVid || isDoc;
            const rawStr = isMedia ? t.slice(4) : t;
            let mediaUrl = "";
            let docFilename = "documento";
            if (isImg || isAud || isVid) {
              mediaUrl = resolveMediaUrl(rawStr);
            } else if (isDoc) {
              const pipeIdx = rawStr.indexOf("|");
              if (pipeIdx >= 0) {
                mediaUrl = resolveMediaUrl(rawStr.slice(0, pipeIdx));
                docFilename = rawStr.slice(pipeIdx + 1);
              } else {
                mediaUrl = resolveMediaUrl(rawStr);
                docFilename = rawStr.split("/").pop() || "documento";
              }
            }
            const isOwn = msg.sender_id === userId;

            const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
            const nextMsg = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;
            const showDate = !prevMsg || !isSameDay(msg.created_at, prevMsg.created_at);
            const grouped = !!prevMsg && isSameGroup(msg, prevMsg);
            const isGroupEnd = !nextMsg || !isSameGroup(nextMsg, msg);

            return (
              <Fragment key={msg.id}>
                {showDate && (
                  <div className="text-center py-3">
                    <span className="text-xs bg-black/15 dark:bg-white/10 text-muted-foreground px-3 py-1 rounded-full font-bold">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.25) }}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}
                  id={`msg-${msg.id}`}
                  onPointerDown={startLongPress(msg)}
                  onPointerUp={cancelLongPress}
                  onPointerMove={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onTouchStart={startLongPressTouch(msg)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onDoubleClick={(e) => { e.preventDefault(); if (wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ type: "reaction", message_id: msg.id, reaction: (msg as any).reaction === "❤️" ? null : "❤️" })); } }}
                  onContextMenu={(e) => { e.preventDefault(); setContextMsg(msg); }}
                >
                  <motion.div
                    drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15} dragDirectionLock
                    onDragEnd={(e, info) => { if (Math.abs(info.offset.x) > 50) { setReplyingTo(msg); setTimeout(() => inputRef.current?.focus(), 50); } }}
                    className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm select-none ${isOwn
                        ? `bg-gradient-to-br from-primary via-[#8B0000] to-black text-white ${isGroupEnd ? "rounded-br-[4px]" : ""}`
                        : `bg-card border border-secondary/25 ${isGroupEnd ? "rounded-bl-[4px]" : ""}`
                      }`}>
                    {(msg as any).reply_to && (
                      <div
                        className="mb-1.5 bg-black/20 dark:bg-white/10 rounded-lg p-2 border-l-4 border-secondary/70 text-xs opacity-90 cursor-pointer"
                        onClick={() => document.getElementById(`msg-${(msg as any).reply_to}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        {(() => {
                          const replied = messages.find(m => m.id === (msg as any).reply_to);
                          return replied ? (
                            <>
                              <span className="font-bold block mb-0.5">{replied.sender_id === userId ? "Tu" : match.name}</span>
                              <p className="truncate max-w-[200px]">{formatLastMessage(replied.text)}</p>
                            </>
                          ) : <span className="italic">Mensagem original</span>;
                        })()}
                      </div>
                    )}
                    {msg.deleted ? (
                      <p className={`text-xs italic ${isOwn ? "text-white/50" : "text-muted-foreground/60"}`}>🚫 Mensagem apagada</p>
                    ) : isImg ? (
                      <img
                        src={mediaUrl}
                        alt="imagem"
                        className="max-w-full rounded-xl cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity"
                        onClick={() => setPreviewImg(mediaUrl)}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : isAud ? (
                      <VoiceMessage src={mediaUrl} isOwn={isOwn} />
                    ) : isVid ? (
                      <VideoMessage src={mediaUrl} isOwn={isOwn} />
                    ) : isDoc ? (
                      <DocMessage url={mediaUrl} filename={docFilename} isOwn={isOwn} />
                    ) : (
                      <p className="font-medium leading-relaxed text-sm break-words">{msg.text}</p>
                    )}
                    {isGroupEnd && (
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] font-bold ${isOwn ? "text-white/55" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isOwn && (
                          <CheckCheck className={`w-3.5 h-3.5 transition-colors ${readUntilId > 0 && msg.id <= readUntilId ? "text-blue-400" : "text-white/35"}`} />
                          <CheckCheck className={`w-3.5 h-3.5 transition-colors ${((msg as any).read_at) || (readUntilId > 0 && msg.id <= readUntilId) ? "text-blue-400" : "text-white/35"}`} />
                        )}
                      </div>
                    )}
                    {(msg as any).reaction && (
                      <div className={`absolute -bottom-3 ${isOwn ? "right-2" : "left-2"} bg-card border border-secondary/20 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm z-10 animate-in zoom-in`}>
                        {(msg as any).reaction}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </Fragment>
            );
          })}
          {/* Typing indicator */}
          <AnimatePresence>
            {peerTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex justify-start"
              >
                <div className="bg-card border-2 border-secondary/20 rounded-3xl rounded-bl-sm px-4 py-3 shadow-md flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-muted-foreground rounded-full"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="relative border-t border-secondary/20 bg-card/95 backdrop-blur-xl shadow-2xl z-10 flex-shrink-0">
        {/* Reply Preview Banner */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card/95 border-b border-secondary/20 px-4 py-2 flex items-center justify-between"
            >
              <div className="flex flex-col border-l-4 border-secondary pl-3 min-w-0">
                <span className="text-xs font-black text-secondary">
                  A responder a {replyingTo.sender_id === userId ? "ti mesmo" : match.name}
                </span>
                <span className="text-sm text-foreground/70 truncate max-w-[250px]">
                  {formatLastMessage(replyingTo.text)}
                </span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/10">
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording banner */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-3 px-4 py-2 bg-red-500/95 border-b border-red-400/30"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse flex-shrink-0" />
              <span className="text-white font-bold text-sm flex-1">
                A gravar... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
              </span>
              <span className="text-white/70 text-xs">Solte para enviar</span>
              <button
                onPointerDown={(e) => { e.stopPropagation(); cancelRecordingRef.current = true; stopRecording(); }}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-4xl mx-auto flex items-center gap-1.5 p-2.5">
          {/* Emoji button */}
          <div className="relative" ref={emojiContainerRef}>
            <button
              onClick={() => setShowEmojis((v) => !v)}
              className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-secondary transition-colors rounded-full hover:bg-secondary/10"
            >
              <Smile className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showEmojis && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.93 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.93 }}
                  className="absolute bottom-12 left-0 bg-card rounded-2xl shadow-2xl border-2 border-primary/15 p-3 grid grid-cols-6 gap-1 z-30 w-60"
                >
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => { setNewMessage((m) => m + em); setShowEmojis(false); setTimeout(() => inputRef.current?.focus(), 30); }}
                      className="text-xl p-1.5 hover:bg-secondary/15 rounded-xl transition-colors text-center"
                    >
                      {em}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Gallery/Vídeo — label direto, sem popup (funciona em iOS/Android) */}
          <label
            htmlFor="chatMediaInput"
            className={`w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-secondary transition-colors rounded-full hover:bg-secondary/10 cursor-pointer flex-shrink-0 ${uploading ? "opacity-40 pointer-events-none" : ""}`}
            title="Foto ou Vídeo"
          >
            <ImageIcon className="w-5 h-5" />
          </label>
          <input id="chatMediaInput" type="file" accept="image/*,video/*" onChange={handleUploadMedia} className="hidden" />

          <label
            htmlFor="chatAudioInput"
            className={`w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-secondary transition-colors rounded-full hover:bg-secondary/10 cursor-pointer flex-shrink-0 ${uploading ? "opacity-40 pointer-events-none" : ""}`}
            title="Áudio"
          >
            <Volume2 className="w-5 h-5" />
          </label>
          <input id="chatAudioInput" type="file" accept="audio/*" onChange={handleUploadAudioFile} className="hidden" />

          {/* Documento — label direto */}
          <label
            htmlFor="chatDocInputDirect"
            className={`w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-secondary transition-colors rounded-full hover:bg-secondary/10 cursor-pointer flex-shrink-0 ${uploading ? "opacity-40 pointer-events-none" : ""}`}
            title="Documento"
          >
            <Paperclip className="w-5 h-5" />
          </label>
          <input id="chatDocInputDirect" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={handleUploadDoc} className="hidden" />

          {/* Text input */}
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (showEmojis) setShowEmojis(false);
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                if (!myTypingRef.current) {
                  myTypingRef.current = true;
                  wsRef.current.send(JSON.stringify({ type: "typing" }));
                }
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  myTypingRef.current = false;
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "typing-stop" }));
                  }
                }, 2000);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                myTypingRef.current = false;
                if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
                handleSend();
              }
            }}
            placeholder={uploading ? "A enviar..." : "Mensagem"}
            disabled={uploading}
            className="flex-1 bg-input-background border border-primary/15 focus:border-secondary rounded-full h-11 px-4 font-medium text-sm disabled:opacity-60"
          />

          {/* Send or Mic (dynamic) */}
          <AnimatePresence mode="wait">
            {newMessage.trim() ? (
              <motion.button
                key="send"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                onClick={handleSend}
                disabled={uploading}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-[#8B0000] flex items-center justify-center shadow-lg flex-shrink-0 disabled:opacity-60"
              >
                <Send className="w-5 h-5 text-white" />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                onTouchStart={(e) => { e.preventDefault(); if (!uploading) startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                onTouchCancel={(e) => { e.preventDefault(); stopRecording(); }}
                onPointerDown={() => { if (!uploading) startRecording(); }}
                onPointerUp={stopRecording}
                onPointerCancel={stopRecording}
                onPointerLeave={stopRecording}
                disabled={uploading}
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 transition-colors ${isRecording ? "bg-red-500 animate-pulse" : "bg-gradient-to-br from-primary to-[#8B0000]"
                  } disabled:opacity-60`}
              >
                <Mic className="w-5 h-5 text-white" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast de erro de envio */}
      <AnimatePresence>
        {sendError && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold max-w-xs text-center"
          >
            <span>{sendError}</span>
            <button onClick={() => setSendError(null)} className="ml-1 opacity-70 hover:opacity-100"><XIcon className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu de contexto (apagar mensagem) */}
      <AnimatePresence>
        {contextMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 flex items-end"
            onClick={() => setContextMsg(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full bg-card rounded-t-3xl shadow-2xl safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-1" />
              <div className="p-3">
                <div className="flex justify-between px-4 py-2 mb-3 bg-secondary/10 rounded-2xl">
                  {["❤️", "😂", "😮", "😢", "😡", "👍"].map(rx => (
                    <button key={rx} onClick={() => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: "reaction", message_id: contextMsg.id, reaction: (contextMsg as any).reaction === rx ? null : rx }));
                      }
                      setContextMsg(null);
                    }}
                      className={`text-2xl hover:scale-125 transition-transform ${(contextMsg as any).reaction === rx ? "scale-125 drop-shadow-md" : ""}`}
                    >{rx}</button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(contextMsg);
                    setContextMsg(null);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="w-full flex items-center gap-3 py-3.5 px-5 text-foreground hover:bg-muted rounded-2xl transition-colors font-bold text-left"
                >
                  <span className="text-lg">↩️</span>
                  <span>Responder</span>
                </button>
                <button
                  onClick={handleDeleteForMe}
                  className="w-full flex items-center gap-3 py-3.5 px-5 text-foreground hover:bg-muted rounded-2xl transition-colors font-bold text-left"
                >
                  <Trash2 className="w-5 h-5 flex-shrink-0" />
                  <span>Apagar para mim</span>
                </button>
                {contextMsg.sender_id === userId && !contextMsg.deleted && (
                  <button
                    onClick={handleDeleteMessage}
                    className="w-full flex items-center gap-3 py-3.5 px-5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-colors font-bold text-left"
                  >
                    <Trash2 className="w-5 h-5 flex-shrink-0" />
                    <span>Apagar para todos</span>
                  </button>
                )}
                {!contextMsg.deleted && contextMsg.text && !contextMsg.text.startsWith("aud:") && !contextMsg.text.startsWith("vid:") && !contextMsg.text.startsWith("doc:") && (
                  <button
                    onClick={() => {
                      const t = contextMsg.text.startsWith("img:") ? contextMsg.text.slice(4) : contextMsg.text;
                      copyText(t).then((ok) => {
                        if (!ok) showSendError("Não foi possível copiar.");
                        setContextMsg(null);
                      });
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-5 text-foreground hover:bg-muted rounded-2xl transition-colors font-bold text-left"
                  >
                    <span className="text-lg">📋</span>
                    <span>Copiar texto</span>
                  </button>
                )}
                <button
                  onClick={() => setContextMsg(null)}
                  className="w-full py-3.5 px-5 text-muted-foreground hover:bg-muted rounded-2xl transition-colors font-bold text-sm mt-1"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} match={match} />

      {/* Image fullscreen preview */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/96 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
              onClick={() => setPreviewImg(null)}
            >
              <XIcon className="w-5 h-5 text-white" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={previewImg}
              alt="preview"
              className="max-w-full max-h-[88dvh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ââ Incoming Call overlay ââ */}
      <AnimatePresence>
        {callState === "incoming" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-secondary shadow-2xl animate-pulse">
              <Avatar photo={match.photos[0]} name={match.name} />
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm font-bold mb-2">
                {callType === "video" ? "📹 Chamada de vídeo" : "📞 Chamada de voz"}
              </p>
              <h2 className="text-3xl font-black text-white">{match.name}</h2>
              <p className="text-secondary font-bold mt-2 animate-pulse">Chamada recebida...</p>
            </div>
            <div className="flex gap-12">
              <button onClick={rejectCall}
                className="w-20 h-20 bg-red-500 hover:bg-red-600 active:scale-95 rounded-full flex flex-col items-center justify-center gap-1 shadow-xl transition-all">
                <PhoneOff className="w-8 h-8 text-white" />
                <span className="text-white text-xs font-bold">Recusar</span>
              </button>
              <button onClick={acceptCall}
                className="w-20 h-20 bg-green-500 hover:bg-green-600 active:scale-95 rounded-full flex flex-col items-center justify-center gap-1 shadow-xl transition-all">
                <PhoneCall className="w-8 h-8 text-white" />
                <span className="text-white text-xs font-bold">Aceitar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ââ Calling (a aguardar) overlay ââ */}
      <AnimatePresence>
        {callState === "calling" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
            {/* Preview da câmara própria enquanto aguarda (só vídeo) */}
            {callType === "video" && (
              <p className="text-secondary/70 text-xs font-bold tracking-wide uppercase">A tua câmara</p>
            )}
            <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-secondary shadow-2xl">
              <Avatar photo={match.photos[0]} name={match.name} />
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm font-bold mb-1">
                {callType === "video" ? "📹 Chamada de vídeo" : "📞 Chamada de voz"}
              </p>
              <h2 className="text-3xl font-black text-white">{match.name}</h2>
              <p className="text-secondary font-bold mt-2 animate-pulse">A chamar...</p>
            </div>
            <button onClick={hangUp}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 active:scale-95 rounded-full flex items-center justify-center shadow-xl transition-all">
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ââ Chamada activa overlay ââ */}
      <AnimatePresence>
        {callState === "connected" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col">

            {/* Área principal: vídeo remoto ou avatar para chamada de voz */}
            <div className="flex-1 relative bg-gray-950 overflow-hidden">
              {callType === "audio" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-secondary shadow-2xl">
                    <Avatar photo={match.photos[0]} name={match.name} />
                  </div>
                  <h2 className="text-3xl font-black text-white">{match.name}</h2>
                  <p className="text-secondary/80 text-sm font-bold animate-pulse">Em chamada de voz</p>
                </div>
              )}
              {/* Nota: o <video remoteVideoRef> está sempre no DOM (acima),
                  posicionado com absolute inset-0 quando callState==="connected" && callType==="video" */}

              {/* Timer */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 px-5 py-2 rounded-full">
                <p className="text-secondary font-black text-sm tracking-widest">{formatDuration(callDuration)}</p>
              </div>

              {/* Nome do outro utilizador (vídeo) */}
              {callType === "video" && (
                <div className="absolute bottom-4 left-4 z-10 bg-black/60 px-3 py-1.5 rounded-full">
                  <p className="text-white font-bold text-sm">{match.name}</p>
                </div>
              )}
            </div>

            {/* Controlos estilo WhatsApp */}
            <div className="bg-black/95 px-3 py-5 md:py-6 flex items-center justify-around flex-shrink-0 border-t border-white/10 safe-bottom">
              <CallBtn onClick={toggleSpeaker} active={!speakerOn}
                label={speakerOn ? "Altifalante" : "Auricular"}
                icon={speakerOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />} />
              <CallBtn onClick={toggleMute} active={muted}
                label={muted ? "Ativar Mic" : "Silenciar"}
                icon={muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />} />
              <button onClick={hangUp}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 active:scale-95 rounded-full flex items-center justify-center shadow-xl transition-all">
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <CallBtn onClick={toggleVideo} active={videoOff}
                label={videoOff ? "Ligar Cam" : "Câmara"}
                icon={videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />} />
              {callType === "video" ? (
                <CallBtn onClick={flipCamera} active={false}
                  label="Inverter"
                  icon={<RefreshCw className="w-5 h-5 text-white" />} />
              ) : (
                <div className="w-14 h-14 opacity-0 pointer-events-none" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileModal({ open, onClose, match }: { open: boolean; onClose: () => void; match: Match }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  if (!open) return null;
  const photos = match.photos || [];
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Photos carousel */}
        <div className="relative h-80 flex-shrink-0 bg-black">
          {photos.length > 0 ? (
            <img src={resolveMediaUrl(photos[photoIdx])} alt={match.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white bg-primary">
              {match.name[0]?.toUpperCase()}
            </div>
          )}
          {/* Photo nav dots */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setPhotoIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? "bg-secondary w-4" : "bg-white/50"}`} />
              ))}
            </div>
          )}
          {/* Left/right tap */}
          {photos.length > 1 && (
            <>
              <button onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-0 top-0 h-full w-1/3" />
              <button onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                className="absolute right-0 top-0 h-full w-1/3" />
            </>
          )}
          {/* Close */}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white font-black text-lg">×</button>
          {match.is_verified === 1 && (
            <div className="absolute top-3 left-3 bg-gradient-to-r from-secondary to-[#FFD700] px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 text-black fill-black" />
              <span className="text-xs font-black text-black">VIP</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <h3 className="font-black text-2xl text-white">{match.name}{match.age ? `, ${match.age}` : ""}</h3>
            {match.location && <p className="text-white/70 text-sm flex items-center gap-1">📍 {match.location}</p>}
          </div>
        </div>
        {/* Info */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {match.work && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">💼</span>
              <span className="font-bold">{match.work}</span>
            </div>
          )}
          {match.education && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">🎓</span>
              <span className="font-bold">{match.education}</span>
            </div>
          )}
          {match.hometown && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">🏠</span>
              <span className="font-bold">De {match.hometown}</span>
            </div>
          )}
          {match.bio && (
            <p className="text-sm text-foreground leading-relaxed border-t border-border pt-3">{match.bio}</p>
          )}
          {match.interests && match.interests.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {match.interests.map((interest) => (
                <span key={interest} className="px-3 py-1 bg-secondary/20 text-secondary rounded-full text-xs font-bold border border-secondary/30">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function CallBtn({ onClick, active, label, icon }: { onClick: () => void; active: boolean; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${active ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}>
      {icon}
      <span className="text-white/60 text-xs">{label}</span>
    </button>
  );
}

function DesktopPlaceholder() {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <AfricanPattern className="absolute inset-0 text-primary opacity-5 pointer-events-none" />
      <div className="text-center px-8 relative z-10">
        <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-1 rounded-full inline-block mb-6 shadow-2xl">
          <div className="bg-black p-8 rounded-full">
            <MessageCircle className="w-16 h-16 text-secondary" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Seleciona uma conversa</h2>
        <p className="text-muted-foreground font-medium mb-8">Escolhe um match à esquerda para começar a falar</p>
        <button
          onClick={() => navigate("/discover")}
          className="px-6 py-3 bg-gradient-to-r from-primary to-[#8B0000] text-white font-black rounded-2xl shadow-lg hover:opacity-90 transition-opacity"
        >
          Descobrir Perfis
        </button>
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

export function TelaChat() {
  const location = useLocation();
  const navState = location.state as {
    matchId?: string;
    matchedProfile?: { id: string; name: string; photos: string[]; age?: number; location?: string };
  } | null;

  const initialMatch: Match | null = navState?.matchId && navState?.matchedProfile
    ? {
      match_id: navState.matchId,
      matched_at: new Date().toISOString(),
      id: navState.matchedProfile.id,
      name: navState.matchedProfile.name,
      age: navState.matchedProfile.age || 0,
      location: navState.matchedProfile.location || "",
      photos: navState.matchedProfile.photos || [],
    }
    : null;

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(initialMatch);

  // Desktop: layout 2 colunas (lista esquerda + conversa direita)
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Coluna esquerda â lista de matches
          Mobile sem match: ocupa tudo | Mobile com match: esconde
          Desktop: sempre sidebar fixa (w-80 / w-96) */}
      <div className={`
        flex flex-col flex-shrink-0 min-h-0
        border-r-2 border-secondary/20
        ${selectedMatch
          ? "hidden md:flex md:w-80 lg:w-96"
          : "w-full md:w-80 lg:w-96"}
      `}>
        <ChatList
          onSelectMatch={setSelectedMatch}
          autoOpenMatchId={navState?.matchId}
          selectedMatchId={selectedMatch?.match_id}
          hideMobileNav={!!selectedMatch}
        />
      </div>

      {/* Coluna direita â conversa activa ou placeholder desktop */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 min-h-0">
        {selectedMatch ? (
          <ChatConversation match={selectedMatch} onBack={() => setSelectedMatch(null)} />
        ) : (
          <DesktopPlaceholder />
        )}
      </div>

      {/* Mobile: conversa abre em full-screen */}
      {selectedMatch && (
        <div className="flex md:hidden flex-1 flex-col min-w-0 min-h-0">
          <ChatConversation match={selectedMatch} onBack={() => setSelectedMatch(null)} />
        </div>
      )}
    </div>
  );
}
