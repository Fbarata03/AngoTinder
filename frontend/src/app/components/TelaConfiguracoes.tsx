import { useState, useEffect } from "react";
import { Settings, User, Bell, Shield, CreditCard, HelpCircle, LogOut, ChevronRight, Heart, MessageCircle, Crown, Eye, EyeOff, MapPin, Mail, Lock, X, Check, ExternalLink, Moon, Sun, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context";
import { authApi } from "../api";

const SETTINGS_KEY = "angotinder_settings";
const GOLD_KEY = "angotinder_gold";

function isGoldActive(): boolean {
  return localStorage.getItem(GOLD_KEY) === "true";
}

function activateGold() {
  localStorage.setItem(GOLD_KEY, "true");
}

// Modal de assinatura Gold — segue nas redes sociais e fica com Gold para sempre
function GoldModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"intro" | "confirm">("intro");
  const [checked, setChecked] = useState({ ig: false, tt: false, yt: false });
  const allChecked = checked.ig && checked.tt && checked.yt;

  const socials = [
    {
      key: "ig", label: "Instagram", handle: "@feliciano_barata",
      url: "https://www.instagram.com/feliciano_barata",
      color: "#E1306C",
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497"/>
              <stop offset="5%" stopColor="#fdf497"/>
              <stop offset="45%" stopColor="#fd5949"/>
              <stop offset="60%" stopColor="#d6249f"/>
              <stop offset="90%" stopColor="#285AEB"/>
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)"/>
          <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none"/>
          <circle cx="17.5" cy="6.5" r="1" fill="white"/>
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      ),
    },
    {
      key: "tt", label: "TikTok", handle: "@feliciano_barata",
      url: "https://www.tiktok.com/@feliciano_barata",
      color: "#010101",
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
          <rect width="24" height="24" rx="6" fill="#010101"/>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z" fill="white"/>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z" fill="#69C9D0" opacity="0.5"/>
        </svg>
      ),
    },
    {
      key: "yt", label: "YouTube", handle: "@feliciano_barata",
      url: "https://www.youtube.com/@feliciano_barata",
      color: "#FF0000",
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7">
          <rect width="24" height="24" rx="6" fill="#FF0000"/>
          <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4.1-1.3.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.8C6.8 19 12 19 12 19s4.8 0 7-.2c.4-.1 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8z" fill="white" opacity="0.2"/>
          <polygon points="10,8.5 10,15.5 16,12" fill="white"/>
        </svg>
      ),
    },
  ] as const;

  const handleActivate = () => {
    activateGold();
    setStep("confirm");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }} transition={{ type: "spring", duration: 0.5 }}
        className="w-full max-w-sm relative">

        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
          <X className="w-5 h-5 text-gray-800" />
        </button>

        <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-3xl shadow-2xl">
          <div className="bg-gradient-to-br from-black via-[#1a0a00] to-black rounded-3xl p-6">

            {step === "intro" ? (
              <>
                <div className="text-center mb-6">
                  <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-4 rounded-2xl inline-block mb-3">
                    <Crown className="w-12 h-12 text-black" />
                  </div>
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary to-[#FFD700]">AngoTinder Gold</h2>
                  <p className="text-white/70 text-sm mt-1">Likes ilimitados · Rewind · Super Likes · e mais!</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 mb-5 border border-secondary/30">
                  <p className="text-secondary font-black text-center text-sm mb-4">Para ativar o Gold GRÁTIS para sempre, segue nas redes sociais:</p>

                  <div className="space-y-3">
                    {socials.map(({ key, label, handle, url, color, icon }) => (
                      <div key={key} className="flex items-center gap-3">
                        <button
                          onClick={() => { window.open(url, "_blank"); setChecked((c) => ({ ...c, [key]: true })); }}
                          className="flex-1 flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:opacity-80 active:scale-95"
                          style={{ backgroundColor: color + "33", border: `2px solid ${checked[key] ? "#FFCD00" : color + "55"}` }}
                        >
                          <div className="flex-shrink-0">{icon}</div>
                          <div className="flex-1">
                            <p className="font-black text-white text-sm">{label}</p>
                            <p className="text-white/60 text-xs">{handle}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-white/40" />
                        </button>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked[key] ? "bg-secondary border-secondary" : "border-white/30"}`}>
                          {checked[key] && <Check className="w-4 h-4 text-black" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleActivate}
                  disabled={!allChecked}
                  className="w-full h-14 text-black font-black text-lg rounded-2xl shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: allChecked ? "linear-gradient(to right, #FFCD00, #FFD700)" : undefined }}
                >
                  {allChecked ? "✅ Ativar Gold GRÁTIS!" : "Segue as 3 contas para ativar"}
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                  className="bg-gradient-to-br from-secondary to-[#FFD700] p-5 rounded-full inline-block mb-4">
                  <Crown className="w-16 h-16 text-black" />
                </motion.div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-secondary to-[#FFD700] mb-2">Gold Ativado!</h2>
                <p className="text-white/80 font-medium mb-1">Obrigado por seguir o Feliciano!</p>
                <p className="text-white/50 text-sm mb-6">Aproveita o AngoTinder Gold para sempre</p>
                <Button onClick={onClose} className="w-full h-12 bg-gradient-to-r from-secondary to-[#FFD700] text-black font-black rounded-2xl">
                  Aproveitar o Gold 🔥
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function TelaConfiguracoes() {
  const navigate = useNavigate();
  const { logout, currentUser, isLoggedIn } = useApp();

  const saved = loadSettings();
  const [settings, setSettings] = useState({
    notifications: { newMatches: true, messages: true, likes: true, ...saved.notifications },
    privacy: { showDistance: true, showOnline: true, incognito: false, showOnlyVerified: false, ...saved.privacy },
    discovery: { showMe: true, globalMode: false, ...saved.discovery },
  });

  const [showGold, setShowGold] = useState(false);
  const [isGold, setIsGold] = useState(isGoldActive());
  const [showChangePw, setShowChangePw] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("angotinder_dark") === "true");

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("angotinder_dark", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("angotinder_dark", "false");
    }
  }, [darkMode]);
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) navigate("/");
  }, [isLoggedIn]);

  // Persist settings to localStorage whenever they change
  const updateSettings = (next: typeof settings) => {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const handleChangePw = async () => {
    setPwError("");
    if (!pw.current || !pw.new || !pw.confirm) return setPwError("Preencha todos os campos");
    if (pw.new !== pw.confirm) return setPwError("As novas senhas não coincidem");
    if (pw.new.length < 6) return setPwError("A nova senha deve ter pelo menos 6 caracteres");
    setPwLoading(true);
    try {
      await authApi.changePassword(pw.current, pw.new);
      setPwSuccess(true);
      setPw({ current: "", new: "", confirm: "" });
      setTimeout(() => { setPwSuccess(false); setShowChangePw(false); }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try { setPwError(JSON.parse(msg).detail || "Senha atual incorreta"); }
      catch { setPwError("Senha atual incorreta"); }
    } finally {
      setPwLoading(false);
    }
  };

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Icon className="w-5 h-5 text-primary" />
        <h3 className="font-black text-lg">{title}</h3>
      </div>
      <div className="bg-card rounded-2xl border-4 border-primary/20 overflow-hidden">{children}</div>
    </div>
  );

  const SwitchItem = ({ icon: Icon, label, description, value, onChange }: {
    icon: React.ElementType; label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-center gap-4 p-5 border-b border-primary/10 last:border-0 hover:bg-secondary/5 transition-colors">
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-3 rounded-xl">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black">{label}</p>
        {description && <p className="text-sm text-muted-foreground font-medium">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  const NavItem = ({ icon: Icon, label, description, onClick }: {
    icon: React.ElementType; label: string; description?: string; onClick?: () => void;
  }) => (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-5 border-b border-primary/10 last:border-0 hover:bg-secondary/5 transition-colors text-left">
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-3 rounded-xl">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black">{label}</p>
        {description && <p className="text-sm text-muted-foreground font-medium truncate">{description}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative overflow-hidden">
      <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
      <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
                <Settings className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-2xl font-black">Configurações</h1>
            </div>
            <button onClick={() => navigate("/profile")} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <User className="w-6 h-6" />
            </button>
          </div>
          <p className="text-secondary mt-2 font-bold">Gerencie sua conta</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 pb-32 relative z-10">
        {/* Gold banner */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl">
            <div className="bg-gradient-to-br from-black via-[#1a0000] to-black p-6 rounded-2xl flex items-center gap-4">
              <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-3 rounded-2xl">
                <Crown className="w-10 h-10 text-black" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-xl text-white mb-1">AngoTinder Gold</h3>
                {isGold
                  ? <p className="text-secondary text-sm font-black">✅ Ativo — Aproveita ao máximo!</p>
                  : <p className="text-white/80 text-sm font-medium">Likes ilimitados, Rewind, Super Likes e muito mais!</p>
                }
              </div>
              {!isGold && (
                <Button onClick={() => setShowGold(true)}
                  className="bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black rounded-xl px-6">
                  Assinar
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Account section with real data */}
        <Section icon={User} title="Conta">
          <NavItem
            icon={Mail}
            label="Email"
            description={currentUser?.email || "—"}
            onClick={() => {}}
          />
          <NavItem
            icon={Lock}
            label="Alterar Senha"
            description="Mude a sua senha de acesso"
            onClick={() => { setShowChangePw(true); setPwError(""); }}
          />
        </Section>

        {/* Change password modal */}
        <AnimatePresence>
          {showChangePw && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-3xl p-8 w-full max-w-sm shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black">Alterar Senha</h3>
                  <button onClick={() => setShowChangePw(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {pwSuccess ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-black text-green-600">Senha alterada com sucesso!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="Senha atual"
                        value={pw.current}
                        onChange={(e) => setPw({ ...pw, current: e.target.value })}
                        className="pl-10 h-12 rounded-2xl border-2"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="Nova senha"
                        value={pw.new}
                        onChange={(e) => setPw({ ...pw, new: e.target.value })}
                        className="pl-10 h-12 rounded-2xl border-2"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="Confirmar nova senha"
                        value={pw.confirm}
                        onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                        className="pl-10 h-12 rounded-2xl border-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPw ? "Ocultar senhas" : "Mostrar senhas"}
                    </button>

                    {pwError && <p className="text-red-500 text-sm font-medium">{pwError}</p>}

                    <Button
                      onClick={handleChangePw}
                      disabled={pwLoading}
                      className="w-full h-12 bg-gradient-to-r from-[#CE1126] to-[#8B0000] text-white font-black rounded-2xl"
                    >
                      {pwLoading ? "A alterar..." : "Alterar Senha"}
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Section icon={Bell} title="Notificações">
          <SwitchItem icon={Heart} label="Novos Matches" description="Receber notificações de novos matches"
            value={settings.notifications.newMatches}
            onChange={(v) => updateSettings({ ...settings, notifications: { ...settings.notifications, newMatches: v } })} />
          <SwitchItem icon={MessageCircle} label="Mensagens" description="Receber notificações de novas mensagens"
            value={settings.notifications.messages}
            onChange={(v) => updateSettings({ ...settings, notifications: { ...settings.notifications, messages: v } })} />
          <SwitchItem icon={Heart} label="Likes" description="Receber notificações quando alguém curtir você"
            value={settings.notifications.likes}
            onChange={(v) => updateSettings({ ...settings, notifications: { ...settings.notifications, likes: v } })} />
        </Section>

        <Section icon={Shield} title="Privacidade">
          <SwitchItem icon={MapPin} label="Mostrar Distância" description="Exibir distância no seu perfil"
            value={settings.privacy.showDistance}
            onChange={(v) => updateSettings({ ...settings, privacy: { ...settings.privacy, showDistance: v } })} />
          <SwitchItem icon={Eye} label="Mostrar Status Online" description="Permitir que outros vejam quando você está online"
            value={settings.privacy.showOnline}
            onChange={(v) => updateSettings({ ...settings, privacy: { ...settings.privacy, showOnline: v } })} />
          <SwitchItem icon={EyeOff} label="Modo Incógnito" description="Apenas pessoas que você curtir verão seu perfil"
            value={settings.privacy.incognito}
            onChange={(v) => updateSettings({ ...settings, privacy: { ...settings.privacy, incognito: v } })} />
        </Section>

        <Section icon={Heart} title="Descoberta">
          <SwitchItem icon={Eye} label="Mostrar-me no AngoTinder" description="Desative para pausar sua conta"
            value={settings.discovery.showMe}
            onChange={(v) => updateSettings({ ...settings, discovery: { ...settings.discovery, showMe: v } })} />
          <SwitchItem icon={MapPin} label="Modo Global" description="Veja pessoas de qualquer lugar"
            value={settings.discovery.globalMode}
            onChange={(v) => updateSettings({ ...settings, discovery: { ...settings.discovery, globalMode: v } })} />
        </Section>

        <Section icon={Settings} title="Outros">
          <NavItem icon={CreditCard} label="Gerenciar Assinatura"
            description={isGold ? "✅ Gold Ativo" : "Segue nas redes e fica Gold grátis!"}
            onClick={() => setShowGold(true)} />
          <NavItem icon={HelpCircle} label="Central de Ajuda"
            description="Suporte e perguntas frequentes"
            onClick={() => window.open("https://www.instagram.com/feliciano_barata", "_blank")} />
          <NavItem icon={Shield} label="Segurança e Privacidade"
            description="Gerir dados e conta"
            onClick={() => setShowPrivacy(true)} />
          <div className="flex items-center gap-4 p-5 border-b border-primary/10 last:border-0 hover:bg-secondary/5 transition-colors cursor-pointer"
            onClick={() => setDarkMode(!darkMode)}>
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-3 rounded-xl">
              {darkMode ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1">
              <p className="font-black">{darkMode ? "Modo Claro" : "Modo Noturno"}</p>
              <p className="text-sm text-muted-foreground font-medium">{darkMode ? "Mudar para tema claro" : "Mudar para tema escuro"}</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${darkMode ? "bg-primary" : "bg-gray-300"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-6" : "translate-x-0"}`} />
            </div>
          </div>
        </Section>

        <Button
          onClick={() => { logout(); navigate("/"); }}
          variant="outline"
          className="w-full h-14 border-4 border-primary/30 hover:border-primary hover:bg-primary/10 rounded-2xl font-black text-primary text-lg flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6 font-medium">AngoTinder v1.0.0</p>
      </div>

      {/* Gold Modal */}
      <AnimatePresence>
        {showGold && (
          <GoldModal onClose={() => { setShowGold(false); setIsGold(isGoldActive()); }} />
        )}
      </AnimatePresence>

      {/* Security & Privacy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-secondary" />
                  <h3 className="text-xl font-black text-white">Segurança e Privacidade</h3>
                </div>
                <button onClick={() => setShowPrivacy(false)} className="text-white/70 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-primary/5 rounded-2xl p-4 border-2 border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <p className="font-black text-sm">A tua conta está protegida</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Os teus dados são encriptados e nunca partilhados com terceiros.</p>
                </div>

                <button onClick={() => { setShowPrivacy(false); setShowChangePw(true); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 transition-colors text-left">
                  <Lock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-black text-sm">Alterar Senha</p>
                    <p className="text-xs text-muted-foreground">Muda a palavra-passe da conta</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>

                <div className="bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <p className="font-black text-sm text-yellow-800">Dados pessoais</p>
                  </div>
                  <p className="text-xs text-yellow-700">O AngoTinder guarda apenas o que colocas no perfil. Não acedemos aos teus contactos, mensagens privadas ou câmara sem permissão.</p>
                </div>

                <div className="bg-red-50 rounded-2xl p-4 border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <p className="font-black text-sm text-red-800">Eliminar conta</p>
                  </div>
                  <p className="text-xs text-red-700 mb-3">Para eliminar a tua conta, envia email para: <strong>suporte@angotinder.com</strong></p>
                </div>

                <Button onClick={() => setShowPrivacy(false)}
                  className="w-full h-12 bg-gradient-to-r from-[#CE1126] to-[#8B0000] text-white font-black rounded-2xl">
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<Heart className="w-6 h-6 fill-current" />} label="Likes" onClick={() => navigate("/likes")} active={false} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={false} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
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
