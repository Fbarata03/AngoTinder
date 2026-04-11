import { motion } from "motion/react";
import { Heart, MessageCircle, X } from "lucide-react";
import { Button } from "./ui/button";
import { AfricanPattern } from "./AfricanPatterns";

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  matchedProfile: { name: string; photo: string };
  userPhoto: string;
}

function Avatar({ photo, name }: { photo: string; name: string }) {
  const colors = ["#CE1126", "#8B0000", "#D4A017", "#006400"];
  const bg = colors[name.charCodeAt(0) % colors.length];
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  if (photo) return <img src={photo} alt={name} className="w-full h-full object-cover" />;
  return (
    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

export function MatchModal({ isOpen, onClose, onSendMessage, matchedProfile, userPhoto }: MatchModalProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="relative max-w-md w-full"
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
        >
          <X className="w-6 h-6 text-primary" />
        </button>

        <div className="bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          <AfricanPattern className="absolute inset-0 text-secondary opacity-10" />

          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: [-100, -300], x: Math.random() * 400 - 200 }}
                transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
                className="absolute top-1/2 left-1/2"
              >
                <Heart className="w-4 h-4 text-secondary fill-secondary" />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", duration: 0.8 }}
            className="text-center relative z-10 mb-8"
          >
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-secondary via-[#FFD700] to-secondary bg-clip-text mb-2">
              É um Match!
            </h1>
            <p className="text-white/90 font-bold text-lg">Vocês deram like um no outro 🔥</p>
          </motion.div>

          <div className="relative flex items-center justify-center mb-8 h-48">
            <motion.div
              initial={{ x: -100, opacity: 0, rotate: -20 }}
              animate={{ x: 0, opacity: 1, rotate: -15 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="absolute left-0 z-10"
            >
              <div className="w-40 h-40 rounded-3xl overflow-hidden border-4 border-secondary shadow-2xl">
                <Avatar photo={userPhoto} name="Eu" />
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring", duration: 0.8 }}
              className="relative z-20"
            >
              <div className="bg-gradient-to-br from-secondary via-[#FFD700] to-secondary p-1 rounded-full shadow-2xl">
                <div className="bg-black p-4 rounded-full">
                  <Heart className="w-12 h-12 text-secondary fill-secondary animate-pulse" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 100, opacity: 0, rotate: 20 }}
              animate={{ x: 0, opacity: 1, rotate: 15 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="absolute right-0 z-10"
            >
              <div className="w-40 h-40 rounded-3xl overflow-hidden border-4 border-secondary shadow-2xl">
                <Avatar photo={matchedProfile.photo} name={matchedProfile.name} />
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="space-y-4 relative z-10"
          >
            <Button
              onClick={onSendMessage}
              className="w-full h-14 bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-6 h-6" />
              Enviar Mensagem
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-14 text-white hover:bg-white/20 font-black text-lg rounded-2xl"
            >
              Continuar Descobrindo
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
