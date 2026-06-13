import { useState, useEffect } from "react";
import { Search, MessageCircle, Users, Heart, UserCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { matchesApi, Match, resolveMediaUrl } from "../api";
import { BottomNav } from "./BottomNav";
import { useApp } from "../context";

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatLastMsg(text: string): string {
  if (!text) return "";
  if (text.startsWith("img:")) return "📷 Imagem";
  if (text.startsWith("aud:")) return "🎵 Áudio";
  if (text.startsWith("vid:")) return "🎬 Vídeo";
  if (text.startsWith("doc:")) return "📎 Documento";
  return text.slice(0, 60);
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

type Tab = "all" | "matches" | "friends";

export function TelaContactos() {
  const navigate = useNavigate();
  const { isLoggedIn } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    matchesApi.getMatches()
      .then(setMatches)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, navigate]);

  const filtered = matches.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === "matches") return m.type !== "friend";
    if (tab === "friends") return m.type === "friend";
    return true;
  });

  const openChat = (m: Match) => {
    navigate("/chat", {
      state: {
        matchId: m.match_id,
        matchedProfile: { id: m.id, name: m.name, photos: m.photos, age: m.age, location: m.location },
      },
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header estilo Telegram */}
      <div className="bg-[var(--tg-header)] text-white px-4 pt-safe pb-3 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Users className="w-6 h-6" />
          <h1 className="text-lg font-bold flex-1">Contactos</h1>
          <span className="text-sm opacity-70">{matches.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar contactos..."
            className="w-full bg-white/15 rounded-xl pl-9 pr-4 py-2 text-white placeholder:text-white/40 text-sm outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border-b border-border flex-shrink-0">
        {(["all", "matches", "friends"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t === "all" ? "Todos" : t === "matches" ? "Matches" : "Amigos"}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 px-8 text-center">
            {tab === "matches" ? (
              <>
                <Heart className="w-12 h-12 text-primary/30" />
                <p className="font-semibold text-foreground">Sem matches ainda</p>
                <p className="text-muted-foreground text-sm">Vai a Descobrir para encontrar pessoas!</p>
                <button onClick={() => navigate("/discover")} className="mt-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold">
                  Descobrir
                </button>
              </>
            ) : tab === "friends" ? (
              <>
                <UserCheck className="w-12 h-12 text-primary/30" />
                <p className="font-semibold text-foreground">Sem amigos ainda</p>
                <p className="text-muted-foreground text-sm">Adiciona pessoas como amigos através da pesquisa.</p>
              </>
            ) : (
              <>
                <Users className="w-12 h-12 text-primary/30" />
                <p className="font-semibold text-foreground">
                  {search ? "Sem resultados" : "Sem contactos ainda"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {search ? "Tenta outra pesquisa." : "Faz match com alguém para começar!"}
                </p>
              </>
            )}
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.match_id}
              onClick={() => openChat(m)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 active:bg-muted transition-colors border-b border-border/40 text-left"
            >
              <div className="relative flex-shrink-0">
                <Avatar photo={m.photos[0]} name={m.name} />
                {m.type === "friend" && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-card flex items-center justify-center">
                    <UserCheck className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-semibold text-foreground truncate text-sm">{m.name}</span>
                    {!!m.is_verified && <span className="text-primary text-xs flex-shrink-0">✓</span>}
                  </div>
                  {m.last_message_at && (
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(m.last_message_at)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-muted-foreground text-xs truncate">
                    {m.last_message ? formatLastMsg(m.last_message) : `${m.age} anos · ${m.location}`}
                  </p>
                  {m.type === "friend" && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                      Amigo
                    </span>
                  )}
                </div>
              </div>

              <MessageCircle className="w-4 h-4 text-primary/40 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      <BottomNav active="contacts" />
    </div>
  );
}
