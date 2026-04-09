import { Heart, Facebook, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { AfricanPattern, AngolanFlag } from "./AfricanPatterns";
import { motion } from "motion/react";
import { useApp } from "../context";
import { useState } from "react";

export function TelaInicial() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (provider: string) => {
    setLoading(true);
    try {
      await login(provider);
      navigate("/discover");
    } catch {
      navigate("/discover");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-[#000000]">
      <div className="absolute inset-0 opacity-20">
        <AfricanPattern className="absolute top-0 left-0 w-96 h-96 text-secondary animate-pulse" />
        <AfricanPattern className="absolute bottom-0 right-0 w-96 h-96 text-secondary animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="absolute top-8 right-8 opacity-30">
        <AngolanFlag className="w-24 h-16" />
      </div>

      <div className="absolute top-1/4 left-10 w-32 h-32 rounded-full bg-secondary/10 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-10 w-40 h-40 rounded-full bg-secondary/10 blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }}></div>

      <div className="relative min-h-screen flex flex-col">
        <div className="flex flex-col items-center pt-20 px-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-secondary rounded-full blur-3xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-full">
              <div className="bg-[#000000] p-7 rounded-full">
                <Heart className="w-20 h-20 text-secondary fill-secondary drop-shadow-[0_0_15px_rgba(255,205,0,0.8)]" />
              </div>
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-secondary animate-pulse" />
            <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-secondary animate-pulse" style={{ animationDelay: "0.5s" }} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-[#FFD700] to-secondary mt-8 tracking-tight drop-shadow-lg"
            style={{ textShadow: "0 0 30px rgba(255,205,0,0.3), 0 0 60px rgba(255,205,0,0.2)" }}
          >
            AngoTinder
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 mt-3"
          >
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-secondary to-transparent"></div>
            <p className="text-secondary/90 font-semibold tracking-widest uppercase text-sm">Made in Angola</p>
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-secondary to-transparent"></div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-white/80 mt-4 text-center max-w-md px-4 text-lg"
          >
            O aplicativo de encontros mais quente de Angola 🔥
          </motion.p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 pb-12 pt-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className="relative bg-gradient-to-br from-[#FFCD00] via-[#FFD700] to-[#FFA500] rounded-3xl p-1 mb-10 max-w-lg mx-auto w-full"
          >
            <div className="bg-[#000000] rounded-3xl p-8 backdrop-blur-xl">
              <h2 className="text-3xl font-black text-secondary text-center mb-4 leading-tight">
                Encontre seu par em Angola
              </h2>
              <div className="flex items-center justify-center gap-3 text-white/90 text-center mb-3">
                <span className="inline-block">📍</span>
                <p className="text-base">Luanda • Benguela • Huambo • Lobito</p>
              </div>
              <p className="text-white/70 text-center text-sm">
                Conecte-se com pessoas incríveis de todo o país
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="space-y-4 max-w-md mx-auto w-full"
          >
            <Button
              onClick={() => handleLogin("facebook")}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#1877F2] to-[#0C63D4] hover:opacity-90 text-white h-16 text-lg rounded-2xl shadow-2xl shadow-blue-900/50 border-2 border-blue-400/20 font-bold"
            >
              <Facebook className="w-7 h-7 mr-3" />
              Continuar com Facebook
            </Button>

            <Button
              onClick={() => handleLogin("google")}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 text-gray-800 h-16 text-lg rounded-2xl shadow-2xl border-2 border-gray-200 font-bold"
            >
              <svg className="w-7 h-7 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com Google
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-secondary/30"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-white/60 uppercase tracking-widest text-xs font-bold">
                  Seguro e Privado
                </span>
              </div>
            </div>

            <p className="text-center text-white/50 text-xs mt-6 px-4 leading-relaxed">
              Ao continuar, você concorda com nossos<br />
              <span className="text-secondary">Termos de Serviço</span> e{" "}
              <span className="text-secondary">Política de Privacidade</span>
            </p>
          </motion.div>
        </div>

        <div className="pb-6 text-center">
          <div className="inline-flex items-center gap-2 text-secondary/60 text-xs">
            <Heart className="w-3 h-3 fill-current" />
            <span>Feito com amor em Angola</span>
            <Heart className="w-3 h-3 fill-current" />
          </div>
        </div>
      </div>
    </div>
  );
}
