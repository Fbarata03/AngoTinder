import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, User, MessageCircle, Send, ArrowLeft, Sparkles, Star,
  Phone, Video, PhoneOff, VideoOff, Mic, MicOff, PhoneCall,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate, useLocation } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion, AnimatePresence } from "motion/react";
import { matchesApi, messagesApi, createChatSocket, Match, Message } from "../api";
import { useApp } from "../context";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

type CallState = "idle" | "incoming" | "calling" | "connected";

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
    return <img src={photo} alt={name} className="w-full h-full object-cover" />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-white" style={{ backgroundColor: bg }}>
      {initials || "?"}
    </div>
  );
}
// ─── Chat List ────────────────────────────────────────────────────────────
function ChatList({ onSelectMatch, autoOpenMatchId }: { onSelectMatch: (m: Match) => void; autoOpenMatchId?: string }) {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const autoOpenedRef = useRef(false);

  const loadMatches = useCallback(() => {
    if (!isLoggedIn) return;
    matchesApi.getMatches()
      .then((m) => {
        setMatches(m);
        setLoading(false);
        // Auto-abrir conversa se veio de um match (só uma vez)
        if (autoOpenMatchId && !autoOpenedRef.current) {
          const found = m.find((x) => x.match_id === autoOpenMatchId);
          if (found) { autoOpenedRef.current = true; onSelectMatch(found); }
        }
      })
      .catch(() => setLoading(false));
  }, [isLoggedIn, autoOpenMatchId, onSelectMatch]);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    loadMatches();
    // Refresh every 8 seconds (catches matches from other users)
    const interval = setInterval(loadMatches, 8000);
    // Also refresh when tab becomes visible again
    const onVisible = () => { if (document.visibilityState === "visible") loadMatches(); };
    document.addEventListener("visibilitychange", onVisible);
    // Listen for new_match events from NotificationProvider
    const onNewMatch = () => loadMatches();
    window.addEventListener("angotinder:new_match", onNewMatch);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("angotinder:new_match", onNewMatch);
    };
  }, [isLoggedIn, loadMatches]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] flex flex-col relative overflow-hidden">
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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
            <p className="text-secondary font-bold">{matches.length} {matches.length === 1 ? "conversa" : "conversas"} 🔥</p>
          </div>
        </div>
      </div>

      {matches.length > 0 && (
        <div className="p-6 border-b-4 border-secondary/30 bg-card/50 backdrop-blur-sm relative z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-black text-lg mb-4 flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5 text-secondary" /> Novos Matches
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {matches.map((m, i) => (
                <motion.button key={m.match_id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }} onClick={() => onSelectMatch(m)} className="flex-shrink-0 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-secondary shadow-lg">
                      <Avatar photo={m.photos[0]} name={m.name} />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-primary to-[#8B0000] rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <Heart className="w-3 h-3 text-white fill-white" />
                    </div>
                  </div>
                  <p className="text-sm mt-2 max-w-[80px] truncate font-bold text-foreground">{m.name}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative z-10 pb-28">
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
          {matches.map((m, i) => (
            <motion.button key={m.match_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }} onClick={() => onSelectMatch(m)}
              className="w-full p-6 border-b border-primary/10 hover:bg-card/70 transition-all flex items-center gap-4 text-left relative group">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-secondary/50 group-hover:border-secondary transition-all shadow-md">
                  <Avatar photo={m.photos[0]} name={m.name} />
                </div>
                <Star className="absolute -top-1 -right-1 w-5 h-5 text-secondary fill-secondary drop-shadow-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black truncate text-lg">{m.name}</h3>
                  {m.last_message_at && (
                    <span className="text-xs text-muted-foreground font-bold">
                      {new Date(m.last_message_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <p className="text-sm truncate text-muted-foreground">{m.last_message || "Diga olá! 👋"}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={true} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
        </div>
      </div>
    </div>
  );
}

// ─── Chat Conversation with Voice/Video Calls ─────────────────────────────
function ChatConversation({ match, onBack }: { match: Match; onBack: () => void }) {
  const { userId } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callStateRef = useRef<CallState>("idle");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    messagesApi.getMessages(match.match_id)
      .then((m) => { setMessages(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, [match.match_id]);

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
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallState("idle");
    setCallDuration(0);
    setMuted(false);
    setVideoOff(false);
  }, []);

  const createPC = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: "ice-candidate", candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
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
  }, [sendSignal, endCall]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      if (!active) return;
      const ws = createChatSocket(match.match_id);
      wsRef.current = ws;

      ws.onopen = () => { if (active) setConnected(true); };
      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
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

          if (type === "ice-candidate" && pcRef.current) {
            try { await pcRef.current.addIceCandidate(payload.candidate as RTCIceCandidateInit); } catch { /* ok */ }
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
      wsRef.current?.close();
      endCall();
    };
  }, [match.match_id, endCall]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startCall = async (type: "audio" | "video") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const pc = createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setCallType(type);
      setCallState("calling");
      sendSignal({ type: "call-offer", sdp: offer.sdp, callType: type });
    } catch {
      alert("Não foi possível aceder ao microfone/câmara. Verifica as permissões.");
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const pc = createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(pendingOfferRef.current);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "call-answer", sdp: answer.sdp });
        setCallState("connected");
        callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      }
    } catch {
      sendSignal({ type: "call-reject" });
      endCall();
      alert("Não foi possível aceder ao microfone/câmara.");
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

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage.trim();
    setNewMessage("");
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text }));
    } else {
      try {
        const msg = await messagesApi.sendMessage(match.match_id, text);
        setMessages((m) => [...m, msg]);
      } catch { /* ignore */ }
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <AfricanPattern className="absolute inset-0 text-primary opacity-5 pointer-events-none" />

      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black px-4 py-3 text-white shadow-2xl z-10 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary shadow-lg flex-shrink-0">
            <Avatar photo={match.photos[0]} name={match.name} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-base truncate">{match.name}</h2>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-secondary animate-pulse" : "bg-white/40"}`} />
              <p className="text-xs font-bold" style={{ color: connected ? "#FFCD00" : "rgba(255,255,255,0.4)" }}>
                {connected ? "Online" : "A ligar..."}
              </p>
            </div>
          </div>
          <button onClick={() => startCall("audio")} disabled={callState !== "idle"}
            title="Chamada de voz"
            className="p-2.5 bg-green-500/20 hover:bg-green-500/40 rounded-xl transition-colors disabled:opacity-40">
            <Phone className="w-5 h-5 text-green-300" />
          </button>
          <button onClick={() => startCall("video")} disabled={callState !== "idle"}
            title="Chamada de vídeo"
            className="p-2.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-xl transition-colors disabled:opacity-40">
            <Video className="w-5 h-5 text-blue-300" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="max-w-4xl mx-auto space-y-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center py-4">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-secondary via-[#FFD700] to-secondary p-0.5 rounded-full shadow-xl">
              <div className="bg-black px-4 py-2 rounded-full flex items-center gap-2">
                <Heart className="w-4 h-4 fill-secondary text-secondary" />
                <span className="font-black text-secondary text-sm">Match com {match.name}!</span>
              </div>
            </div>
          </motion.div>

          {loading && <p className="text-center text-muted-foreground font-medium text-sm">A carregar mensagens...</p>}

          {messages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-3xl px-4 py-2.5 shadow-md ${
                msg.sender_id === userId
                  ? "bg-gradient-to-r from-primary via-[#8B0000] to-black text-white rounded-br-sm"
                  : "bg-card border-2 border-secondary/20 rounded-bl-sm"
              }`}>
                <p className="font-medium leading-relaxed text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 font-bold ${msg.sender_id === userId ? "text-secondary/70" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="relative border-t-4 border-secondary/30 p-3 bg-card/95 backdrop-blur-xl shadow-2xl z-10 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Input ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Escreva uma mensagem..."
            className="flex-1 bg-input-background border-2 border-primary/20 focus:border-secondary rounded-2xl h-12 px-4 font-medium text-sm" />
          <Button onClick={handleSend}
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-primary via-[#8B0000] to-black hover:opacity-90 flex items-center justify-center p-0 shadow-xl flex-shrink-0">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ── Incoming Call ── */}
      <AnimatePresence>
        {callState === "incoming" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-8">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-secondary shadow-2xl animate-pulse">
              <Avatar photo={match.photos[0]} name={match.name} />
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm font-bold mb-2">
                {callType === "video" ? "📹 Chamada de vídeo" : "📞 Chamada de voz"}
              </p>
              <h2 className="text-3xl font-black text-white">{match.name}</h2>
              <p className="text-secondary font-bold mt-2 animate-pulse">A ligar para ti...</p>
            </div>
            <div className="flex gap-12 mt-2">
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

      {/* ── Calling (waiting) ── */}
      <AnimatePresence>
        {callState === "calling" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-8">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-secondary shadow-2xl">
              <Avatar photo={match.photos[0]} name={match.name} />
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm font-bold mb-2">
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

      {/* ── Active Call ── */}
      <AnimatePresence>
        {callState === "connected" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col">
            <div className="flex-1 relative flex items-center justify-center bg-gray-900">
              {callType === "video" ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-secondary shadow-2xl">
                    <Avatar photo={match.photos[0]} name={match.name} />
                  </div>
                  <h2 className="text-3xl font-black text-white">{match.name}</h2>
                  <p className="text-white/40 text-sm">Em chamada</p>
                </div>
              )}

              {callType === "video" && (
                <div className="absolute top-4 right-4 w-24 h-32 rounded-xl overflow-hidden border-2 border-secondary shadow-xl bg-gray-800">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              )}

              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1.5 rounded-full">
                <p className="text-secondary font-black text-sm">{formatDuration(callDuration)}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-black/95 px-8 py-6 flex items-center justify-around flex-shrink-0">
              <button onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${muted ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}>
                {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                <span className="text-white/60 text-xs">{muted ? "Ligar" : "Mudo"}</span>
              </button>

              <button onClick={hangUp}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 active:scale-95 rounded-full flex items-center justify-center shadow-xl transition-all">
                <PhoneOff className="w-7 h-7 text-white" />
              </button>

              {callType === "video" ? (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${videoOff ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
                  <span className="text-white/60 text-xs">{videoOff ? "Ativar" : "Câmara"}</span>
                </button>
              ) : (
                <button disabled className="w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 bg-white/10 opacity-40">
                  <VideoOff className="w-6 h-6 text-white" />
                  <span className="text-white/60 text-xs">Vídeo</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  if (selectedMatch) return <ChatConversation match={selectedMatch} onBack={() => setSelectedMatch(null)} />;
  return <ChatList onSelectMatch={setSelectedMatch} autoOpenMatchId={navState?.matchId} />;
}
