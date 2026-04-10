import { Heart, Sparkles, Mail, Lock, Eye, EyeOff, Phone, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate } from "react-router";
import { AfricanPattern, AngolanFlag } from "./AfricanPatterns";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context";
import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { authApi } from "../api";

export function TelaInicial() {
  const navigate = useNavigate();
  const { login, loginWithToken } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Phone modal state
  const [showPhone, setShowPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"number" | "code">("number");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

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

  // Google OAuth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError("");
      try {
        const res = await authApi.googleAuth(tokenResponse.access_token);
        loginWithToken(res.token, res.user);
        navigate("/discover");
      } catch {
        setError("Erro ao entrar com Google. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Login com Google cancelado."),
  });

  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google Login não configurado. Configure VITE_GOOGLE_CLIENT_ID.");
      return;
    }
    googleLogin();
  };

  // Phone login
  const handlePhoneSend = async () => {
    if (!phone.trim() || phone.length < 9) {
      setPhoneError("Número inválido");
      return;
    }
    setPhoneLoading(true);
    setPhoneError("");
    try {
      await authApi.sendPhoneCode(phone.trim());
      setPhoneStep("code");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try { setPhoneError(JSON.parse(msg).detail || "Erro ao enviar código"); }
      catch { setPhoneError("Erro ao enviar código"); }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneVerify = async () => {
    if (!phoneCode.trim() || phoneCode.length !== 6) {
      setPhoneError("Código deve ter 6 dígitos");
      return;
    }
    setPhoneLoading(true);
    setPhoneError("");
    try {
      const res = await authApi.verifyPhoneCode(phone.trim(), phoneCode.trim());
      loginWithToken(res.token, res.user);
      navigate("/discover");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try { setPhoneError(JSON.parse(msg).detail || "Código inválido"); }
      catch { setPhoneError("Código inválido"); }
    } finally {
      setPhoneLoading(false);
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

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/20" />
                  <span className="text-white/40 text-sm font-bold">ou</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>

                {/* Google Button */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-14 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-2xl font-black text-base flex items-center gap-3 px-5 transition-colors shadow-lg mb-3"
                >
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="flex-1 text-center">Continuar com a Google</span>
                </button>

                {/* Phone Button */}
                <button
                  onClick={() => { setShowPhone(true); setPhoneStep("number"); setPhone(""); setPhoneCode(""); setPhoneError(""); }}
                  className="w-full h-14 bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-white/40 text-white rounded-2xl font-black text-base flex items-center gap-3 px-5 transition-colors"
                >
                  <Phone className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-center">Entrar com número de telefone</span>
                </button>

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

      {/* Phone Login Modal */}
      <AnimatePresence>
        {showPhone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border-2 border-secondary/30 rounded-3xl p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
                    <Phone className="w-5 h-5 text-black" />
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {phoneStep === "number" ? "Número de Telefone" : "Verificar Código"}
                  </h3>
                </div>
                <button onClick={() => setShowPhone(false)} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {phoneStep === "number" ? (
                <div className="space-y-4">
                  <p className="text-white/60 text-sm">Introduza o seu número de telefone angolano</p>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-black text-sm">+244</div>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      placeholder="9XX XXX XXX"
                      className="pl-16 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                    />
                  </div>
                  {phoneError && <p className="text-red-400 text-sm">{phoneError}</p>}
                  <Button
                    onClick={handlePhoneSend}
                    disabled={phoneLoading}
                    className="w-full h-12 bg-gradient-to-r from-secondary to-[#FFD700] text-black font-black rounded-2xl"
                  >
                    {phoneLoading ? "A enviar..." : "Enviar Código SMS"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-white/60 text-sm">Introduza o código de 6 dígitos enviado para +244 {phone}</p>
                  <Input
                    type="text"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-center text-2xl font-black tracking-widest"
                  />
                  {phoneError && <p className="text-red-400 text-sm">{phoneError}</p>}
                  <Button
                    onClick={handlePhoneVerify}
                    disabled={phoneLoading}
                    className="w-full h-12 bg-gradient-to-r from-secondary to-[#FFD700] text-black font-black rounded-2xl"
                  >
                    {phoneLoading ? "A verificar..." : "Verificar Código"}
                  </Button>
                  <button
                    onClick={() => { setPhoneStep("number"); setPhoneError(""); }}
                    className="w-full text-white/40 text-sm hover:text-white/70 transition-colors"
                  >
                    Reenviar código
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
