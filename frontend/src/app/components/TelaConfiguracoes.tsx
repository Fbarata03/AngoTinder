import { useState, useEffect } from "react";
import { Settings, User, Bell, Shield, CreditCard, HelpCircle, LogOut, ChevronRight, Heart, MessageCircle, Crown, Eye, EyeOff, MapPin, Mail, Lock, X, Check, ExternalLink } from "lucide-react";
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
    { key: "ig", label: "Instagram", handle: "@feliciano_barata", url: "https://www.instagram.com/feliciano_barata", color: "#E1306C", icon: "📸" },
    { key: "tt", label: "TikTok", handle: "@feliciano_barata", url: "https://www.tiktok.com/@feliciano_barata", color: "#010101", icon: "🎵" },
    { key: "yt", label: "YouTube", handle: "@feliciano_barata", url: "https://www.youtube.com/@feliciano_barata", color: "#FF0000", icon: "▶️" },
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
                          <span className="text-2xl">{icon}</span>
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
      <div className="bg-white rounded-2xl border-4 border-primary/20 overflow-hidden">{children}</div>
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
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] relative overflow-hidden">
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
                className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
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
            description="Protege a tua conta"
            onClick={() => {}} />
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

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-around">
          <NavBtn icon={<Heart className="w-6 h-6" />} label="Descobrir" onClick={() => navigate("/discover")} active={false} />
          <NavBtn icon={<MessageCircle className="w-6 h-6" />} label="Chat" onClick={() => navigate("/chat")} active={false} />
          <NavBtn icon={<User className="w-6 h-6" />} label="Perfil" onClick={() => navigate("/profile")} active={false} />
          <NavBtn icon={<Settings className="w-6 h-6" />} label="Ajustes" onClick={() => navigate("/settings")} active={true} />
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
