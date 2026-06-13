import { useState, useEffect } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, Video } from "lucide-react";
import { useNavigate } from "react-router";
import { matchesApi, Match, resolveMediaUrl } from "../api";
import { BottomNav } from "./BottomNav";
import { useApp } from "../context";

export interface CallRecord {
  matchId: string;
  userId: string;
  name: string;
  photo?: string;
  type: "incoming" | "outgoing" | "missed";
  callType: "audio" | "video";
  at: string;
  duration?: number;
}

const CALL_HISTORY_KEY = "angotinder_call_history";

export function loadCallHistory(): CallRecord[] {
  try {
    const raw = localStorage.getItem(CALL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCallRecord(record: CallRecord) {
  try {
    const history = loadCallHistory();
    history.unshift(record);
    localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {}
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatDuration(secs?: number): string {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Avatar({ photo, name }: { photo?: string; name: string }) {
  const colors = ["#CE1126", "#2AABEE", "#D4A017", "#006400", "#8B0000", "#54C4F5"];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  if (photo) {
    return <img src={resolveMediaUrl(photo)} alt={name} className="w-12 h-12 rounded-full object-cover" />;
  }
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-base" style={{ backgroundColor: bg }}>
      {initials || "?"}
    </div>
  );
}

export function TelaChamadas() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    setCallHistory(loadCallHistory());
    matchesApi.getMatches()
      .then(setMatches)
      .catch(() => {})
      .finally(() => setLoadingMatches(false));
  }, [isLoggedIn, navigate]);

  const goToChat = (m: Match) => {
    navigate("/chat", {
      state: {
        matchId: m.match_id,
        matchedProfile: { id: m.id, name: m.name, photos: m.photos, age: m.age, location: m.location },
      },
    });
  };

  const callFromHistory = (record: CallRecord) => {
    const m = matches.find((x) => x.match_id === record.matchId);
    if (m) goToChat(m);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="bg-[var(--tg-header)] text-white px-4 pt-safe pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Phone className="w-6 h-6" />
          <h1 className="text-lg font-bold">Chamadas</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Histórico de chamadas */}
        {callHistory.length > 0 && (
          <div>
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Histórico
            </p>
            {callHistory.map((record, i) => (
              <button
                key={i}
                onClick={() => callFromHistory(record)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 active:bg-muted transition-colors border-b border-border/40 text-left"
              >
                <div className="flex-shrink-0">
                  <Avatar photo={record.photo} name={record.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{record.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {record.type === "incoming" ? (
                      <PhoneIncoming className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : record.type === "outgoing" ? (
                      <PhoneOutgoing className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <PhoneMissed className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    {record.callType === "video" && (
                      <Video className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`text-xs ${record.type === "missed" ? "text-red-500" : "text-muted-foreground"}`}>
                      {record.type === "incoming" ? "Recebida" : record.type === "outgoing" ? "Realizada" : "Não atendida"}
                      {record.duration ? ` · ${formatDuration(record.duration)}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(record.at)}</span>
                  </div>
                </div>
                <Phone className="w-4 h-4 text-primary/50 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Contactos disponíveis para ligar */}
        <div>
          <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {callHistory.length > 0 ? "Contactos" : "Ligar para"}
          </p>
          {loadingMatches ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 px-8 text-center">
              <PhoneCall className="w-12 h-12 text-primary/30" />
              <p className="font-semibold text-foreground">Sem contactos para ligar</p>
              <p className="text-muted-foreground text-sm">
                Faz match com alguém para poder fazer chamadas!
              </p>
            </div>
          ) : (
            matches.map((m) => (
              <div
                key={m.match_id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
              >
                <Avatar photo={m.photos[0]} name={m.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{m.name}</p>
                  <p className="text-muted-foreground text-xs">{m.age} anos · {m.location}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToChat(m)}
                    className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                    title="Chamada de voz"
                  >
                    <Phone className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={() => goToChat(m)}
                    className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                    title="Videochamada"
                  >
                    <Video className="w-4 h-4 text-primary" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav active="calls" />
    </div>
  );
}
