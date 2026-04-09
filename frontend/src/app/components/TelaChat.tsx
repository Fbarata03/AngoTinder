import { useState, useEffect, useRef } from "react";
import { Heart, User, MessageCircle, Send, ArrowLeft, Sparkles, Star } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { matchesApi, messagesApi, Match, Message } from "../api";
import { useApp } from "../context";
import { MOCK_MATCHES, MOCK_MESSAGES } from "../mockData";

function ChatList({ onSelectMatch }: { onSelectMatch: (m: Match) => void }) {
  const navigate = useNavigate();
  const { userId, isLoggedIn } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    matchesApi.getMatches(userId)
      .then((m) => { setMatches(m.length > 0 ? m : MOCK_MATCHES); setLoading(false); })
      .catch(() => { setMatches(MOCK_MATCHES); setLoading(false); });
  }, [userId, isLoggedIn]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] flex flex-col relative overflow-hidden">
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
            <p className="text-secondary font-bold">{matches.length} conversas {matches.length === 1 ? "esperando" : "esperando"} 🔥</p>
          </div>
        </div>
      </div>

      {matches.length > 0 && (
        <div className="p-6 border-b-4 border-secondary/30 bg-white/50 backdrop-blur-sm relative z-10">
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
                      <img src={m.photos[0] || "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200"}
                        alt={m.name} className="w-full h-full object-cover" />
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
              className="w-full p-6 border-b border-primary/10 hover:bg-white/70 transition-all flex items-center gap-4 text-left relative group">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-secondary/50 group-hover:border-secondary transition-all shadow-md">
                  <img src={m.photos[0] || "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200"}
                    alt={m.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-gradient-to-br from-primary to-[#8B0000] rounded-full border-2 border-white shadow-lg"></div>
                <Star className="absolute -top-1 -right-1 w-5 h-5 text-secondary fill-secondary drop-shadow-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black truncate text-lg">{m.name}</h3>
                  <span className="text-sm text-muted-foreground font-bold">Agora</span>
                </div>
                <p className="text-sm truncate font-bold text-foreground">{m.location}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-[#8B0000] rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg">1</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={true} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
        </div>
      </div>
    </div>
  );
}

function ChatConversation({ match, onBack }: { match: Match; onBack: () => void }) {
  const { userId } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesApi.getMessages(match.match_id)
      .then((m) => { setMessages(m.length > 0 ? m : MOCK_MESSAGES.filter(msg => msg.match_id === match.match_id)); setLoading(false); })
      .catch(() => { setMessages(MOCK_MESSAGES.filter(msg => msg.match_id === match.match_id)); setLoading(false); });
  }, [match.match_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage("");
    try {
      const msg = await messagesApi.sendMessage(match.match_id, userId, text);
      setMessages((m) => [...m, msg]);
    } catch {
      setMessages((m) => [...m, { id: Date.now(), match_id: match.match_id, sender_id: userId, text, created_at: new Date().toISOString() }]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] flex flex-col relative overflow-hidden">
      <AfricanPattern className="absolute inset-0 text-primary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-4 text-white shadow-2xl z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-14 h-14 rounded-full overflow-hidden border-4 border-secondary shadow-lg">
            <img src={match.photos[0] || "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200"} alt={match.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-lg">{match.name}</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <p className="text-sm text-secondary font-bold">Online agora</p>
            </div>
          </div>
          <Sparkles className="w-6 h-6 text-secondary animate-pulse" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center py-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-secondary via-[#FFD700] to-secondary p-1 rounded-full mb-3 shadow-xl">
              <div className="bg-black px-5 py-2.5 rounded-full flex items-center gap-2">
                <Heart className="w-5 h-5 fill-secondary text-secondary" />
                <span className="font-black text-secondary">Match com {match.name}!</span>
              </div>
            </div>
          </motion.div>

          {loading && <p className="text-center text-muted-foreground font-medium">A carregar mensagens...</p>}

          {messages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-3xl px-5 py-3.5 shadow-lg ${msg.sender_id === userId ? "bg-gradient-to-r from-primary via-[#8B0000] to-black text-white" : "bg-white border-2 border-secondary/30"}`}>
                <p className="font-medium leading-relaxed">{msg.text}</p>
                <p className={`text-xs mt-1.5 font-bold ${msg.sender_id === userId ? "text-secondary" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="relative border-t-4 border-secondary/30 p-4 bg-white/95 backdrop-blur-xl shadow-2xl z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escreva uma mensagem..."
            className="flex-1 bg-input-background border-4 border-primary/20 focus:border-secondary rounded-2xl h-14 px-5 font-medium text-base" />
          <Button onClick={handleSend}
            className="w-14 h-14 rounded-2xl bg-gradient-to-r from-primary via-[#8B0000] to-black hover:opacity-90 flex items-center justify-center p-0 shadow-xl">
            <Send className="w-6 h-6" />
          </Button>
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

export function TelaChat() {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  if (selectedMatch) return <ChatConversation match={selectedMatch} onBack={() => setSelectedMatch(null)} />;
  return <ChatList onSelectMatch={setSelectedMatch} />;
}
