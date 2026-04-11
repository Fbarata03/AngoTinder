import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, X } from "lucide-react";
import { createNotificationSocket } from "../api";
import { useApp } from "../context";

interface MatchNotif {
  id: string;
  match_id: string;
  user: { id: string; name: string; photos: string[] };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, userId } = useApp();
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [matchNotifs, setMatchNotifs] = useState<MatchNotif[]>([]);

  const dismiss = useCallback((id: string) => {
    setMatchNotifs((n) => n.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let active = true;

    const connect = () => {
      if (!active) return;
      try {
        const ws = createNotificationSocket();
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "new_match") {
              const notif: MatchNotif = {
                id: `${payload.match_id}-${Date.now()}`,
                match_id: payload.match_id,
                user: payload.user,
              };
              setMatchNotifs((n) => [notif, ...n].slice(0, 3));
              // Auto-dismiss after 8 seconds
              setTimeout(() => dismiss(notif.id), 8000);
              // Dispatch event so ChatList can refresh instantly
              window.dispatchEvent(new Event("angotinder:new_match"));
            }
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          if (!active) return;
          reconnectRef.current = setTimeout(() => { if (active) connect(); }, 4000);
        };
        ws.onerror = () => ws.close();
      } catch { /* ignore */ }
    };

    connect();

    return () => {
      active = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [isLoggedIn, userId, dismiss]);

  return (
    <>
      {children}

      {/* Match notifications — visible on any screen */}
      <div className="fixed top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {matchNotifs.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-sm pointer-events-auto"
            >
              <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-0.5 rounded-2xl shadow-2xl">
                <div className="bg-gradient-to-br from-black via-[#1a0000] to-black rounded-2xl px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary flex-shrink-0">
                    {notif.user.photos[0] ? (
                      <img src={notif.user.photos[0]} alt={notif.user.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#CE1126] flex items-center justify-center text-white font-black text-lg">
                        {notif.user.name[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Heart className="w-3 h-3 text-secondary fill-secondary flex-shrink-0" />
                      <p className="text-secondary font-black text-xs">É um Match!</p>
                    </div>
                    <p className="text-white font-bold text-sm truncate">Tu e {notif.user.name} gostaram um do outro 🔥</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        dismiss(notif.id);
                        navigate("/chat", {
                          state: {
                            matchId: notif.match_id,
                            matchedProfile: { id: notif.user.id, name: notif.user.name, photos: notif.user.photos },
                          },
                        });
                      }}
                      className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center hover:bg-[#FFD700] transition-colors"
                      title="Ver conversa"
                    >
                      <MessageCircle className="w-4 h-4 text-black" />
                    </button>
                    <button
                      onClick={() => dismiss(notif.id)}
                      className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                      title="Fechar"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
