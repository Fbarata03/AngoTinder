import { Heart, Sparkles, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate } from "react-router";
import { AfricanPattern, AngolanFlag } from "./AfricanPatterns";
import { motion } from "motion/react";
import { useApp } from "../context";
import { useState } from "react";

export function TelaInicial() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/discover");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.detail || "Email ou senha incorretos");
      } catch {
        setError("Email ou senha incorretos");
      }
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

      <div className="relative min-h-screen flex flex-col">
        <div className="flex flex-col items-center pt-16 px-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-secondary rounded-full blur-3xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-full">
              <div className="bg-[#000000] p-6 rounded-full">
                <Heart className="w-16 h-16 text-secondary fill-secondary drop-shadow-[0_0_15px_rgba(255,205,0,0.8)]" />
              </div>
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-secondary animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-[#FFD700] to-secondary mt-6 tracking-tight"
          >
            AngoTinder
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/80 mt-2 text-center text-base"
          >
            O aplicativo de encontros mais quente de Angola 🔥
          </motion.p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 pb-12 pt-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="max-w-md mx-auto w-full"
          >
            <div className="bg-gradient-to-br from-[#FFCD00] via-[#FFD700] to-[#FFA500] rounded-3xl p-1 shadow-2xl">
              <div className="bg-[#000000] rounded-3xl p-8">
                <h2 className="text-2xl font-black text-secondary text-center mb-6">Entrar na conta</h2>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="pl-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha"
                      className="pl-12 pr-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/60 hover:text-secondary"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm text-center font-medium">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-[#CE1126] to-[#8B0000] hover:opacity-90 text-white text-lg rounded-2xl font-black shadow-xl mt-2"
                  >
                    {loading ? "A entrar..." : "Entrar"}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-white/60 text-sm">
                    Não tem conta?{" "}
                    <button
                      onClick={() => navigate("/register")}
                      className="text-secondary font-black hover:underline"
                    >
                      Criar conta
                    </button>
                  </p>
                </div>
              </div>
            </div>
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
