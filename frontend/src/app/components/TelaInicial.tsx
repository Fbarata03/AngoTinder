import { Heart, Sparkles, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useNavigate } from "react-router";
import { AfricanPattern, AngolanFlag } from "./AfricanPatterns";
import { motion } from "motion/react";
import { useApp } from "../context";
import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";
import { authApi } from "../api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FACEBOOK_APP_ID = (import.meta as any).env?.VITE_FACEBOOK_APP_ID || "";

export function TelaInicial() {
  const navigate = useNavigate();
  const { login, loginWithToken } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return setError("Preencha todos os campos");
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/discover");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try { setError(JSON.parse(msg).detail || "Email ou senha incorretos"); }
      catch { setError("Email ou senha incorretos"); }
    } finally {
      setLoading(false);
    }
  };

  const GoogleLoginButton = ({ disabled }: { disabled: boolean }) => {
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

    return (
      <button
        onClick={() => {
          setError("");
          googleLogin();
        }}
        disabled={disabled}
        className="w-full h-14 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-2xl font-black text-base flex items-center gap-3 px-5 transition-colors shadow-lg mb-3 disabled:opacity-60"
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
    );
  };

  // Facebook OAuth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFacebookResponse = async (res: any) => {
    if (!res?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const auth = await authApi.facebookAuth(res.accessToken);
      loginWithToken(auth.token, auth.user);
      navigate("/discover");
    } catch {
      setError("Erro ao entrar com Facebook. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-[#000000] flex flex-col">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <AfricanPattern className="absolute top-0 left-0 w-96 h-96 text-secondary animate-pulse" />
        <AfricanPattern className="absolute bottom-0 right-0 w-96 h-96 text-secondary animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      <div className="absolute top-4 right-4 opacity-30 pointer-events-none">
        <AngolanFlag className="w-16 h-11" />
      </div>

      <div className="relative flex flex-col h-full overflow-y-auto">
        {/* Logo */}
        <div className="flex flex-col items-center pt-10 px-6 flex-shrink-0">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-secondary rounded-full blur-3xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-full">
              <div className="bg-[#000000] p-5 rounded-full">
                <Heart className="w-12 h-12 text-secondary fill-secondary drop-shadow-[0_0_15px_rgba(255,205,0,0.8)]" />
              </div>
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-secondary animate-pulse" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary via-[#FFD700] to-secondary mt-4 tracking-tight"
          >
            AngoTinder
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-white/80 mt-1 text-center text-sm"
          >
            O aplicativo de encontros mais quente de Angola 🔥
          </motion.p>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center px-6 pb-6 pt-5">
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="max-w-md mx-auto w-full"
          >
            <div className="bg-gradient-to-br from-[#FFCD00] via-[#FFD700] to-[#FFA500] rounded-3xl p-1 shadow-2xl">
              <div className="bg-[#000000] rounded-3xl p-6">
                <h2 className="text-xl font-black text-secondary text-center mb-5">Entrar na conta</h2>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                    <Input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="pl-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                    <Input
                      type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="Senha"
                      className="pl-12 pr-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/60 hover:text-secondary">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {error && <p className="text-red-400 text-sm text-center font-medium">{error}</p>}

                  <Button type="submit" disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-[#CE1126] to-[#8B0000] hover:opacity-90 text-white text-lg rounded-2xl font-black shadow-xl mt-2">
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
                {GOOGLE_CLIENT_ID ? (
                  <GoogleLoginButton disabled={loading} />
                ) : (
                  <button
                    onClick={() => setError("Configure VITE_GOOGLE_CLIENT_ID no Netlify para ativar Google Login.")}
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
                )}

                {/* Facebook Button */}
                {FACEBOOK_APP_ID ? (
                  <FacebookLogin
                    appId={FACEBOOK_APP_ID}
                    autoLoad={false}
                    scope="public_profile"
                    fields="name,picture"
                    callback={handleFacebookResponse}
                    render={(renderProps: { onClick: () => void; isDisabled?: boolean }) => (
                      <button
                        onClick={renderProps.onClick}
                        disabled={loading || renderProps.isDisabled}
                        className="w-full h-14 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-2xl font-black text-base flex items-center gap-3 px-5 transition-colors shadow-lg disabled:opacity-60"
                      >
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                        <span className="flex-1 text-center">Continuar com o Facebook</span>
                      </button>
                    )}
                  />
                ) : (
                  <button
                    onClick={() => setError("Configure VITE_FACEBOOK_APP_ID no Netlify para ativar Facebook Login.")}
                    className="w-full h-14 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-2xl font-black text-base flex items-center gap-3 px-5 transition-colors shadow-lg"
                  >
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span className="flex-1 text-center">Continuar com o Facebook</span>
                  </button>
                )}

                <div className="mt-4 text-center">
                  <p className="text-white/60 text-sm">
                    Não tem conta?{" "}
                    <button onClick={() => navigate("/register")} className="text-secondary font-black hover:underline">
                      Criar conta
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="pb-4 text-center flex-shrink-0">
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
