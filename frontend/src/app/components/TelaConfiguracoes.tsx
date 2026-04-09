import { useState } from "react";
import { Settings, User, Bell, Shield, CreditCard, HelpCircle, LogOut, ChevronRight, Heart, MessageCircle, Crown, Eye, EyeOff, MapPin, Smartphone, Mail, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { useApp } from "../context";

export function TelaConfiguracoes() {
  const navigate = useNavigate();
  const { logout } = useApp();
  const [settings, setSettings] = useState({
    notifications: { newMatches: true, messages: true, likes: true, superLikes: true },
    privacy: { showDistance: true, showOnline: true, incognito: false, showOnlyVerified: false },
    discovery: { showMe: true, globalMode: false },
  });

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Icon className="w-5 h-5 text-primary" />
        <h3 className="font-black text-lg">{title}</h3>
      </div>
      <div className="bg-white rounded-2xl border-4 border-primary/20 overflow-hidden">{children}</div>
    </div>
  );

  const Item = ({ icon: Icon, label, description, action, value, onChange }: {
    icon: React.ElementType; label: string; description?: string; action: "switch" | "navigate"; value?: boolean; onChange?: (v: boolean) => void;
  }) => (
    <div className="flex items-center gap-4 p-5 border-b border-primary/10 last:border-0 hover:bg-secondary/5 transition-colors">
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-3 rounded-xl">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black">{label}</p>
        {description && <p className="text-sm text-muted-foreground font-medium">{description}</p>}
      </div>
      {action === "switch" && <Switch checked={value} onCheckedChange={onChange} />}
      {action === "navigate" && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </div>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl">
            <div className="bg-gradient-to-br from-black via-[#1a0000] to-black p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-3 rounded-2xl">
                  <Crown className="w-10 h-10 text-black" />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-xl text-white mb-1">AngoTinder Gold</h3>
                  <p className="text-white/80 text-sm font-medium">Likes ilimitados, Rewind, Super Likes e muito mais!</p>
                </div>
                <Button className="bg-gradient-to-r from-secondary to-[#FFD700] text-black hover:opacity-90 font-black rounded-xl px-6">Assinar</Button>
              </div>
            </div>
          </div>
        </motion.div>

        <Section icon={User} title="Conta">
          <Item icon={Smartphone} label="Telefone" description="+244 912 345 678" action="navigate" />
          <Item icon={Mail} label="Email" description="utilizador@exemplo.com" action="navigate" />
          <Item icon={Lock} label="Alterar Senha" action="navigate" />
        </Section>

        <Section icon={Bell} title="Notificações">
          <Item icon={Heart} label="Novos Matches" description="Receber notificações de novos matches" action="switch"
            value={settings.notifications.newMatches}
            onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, newMatches: v } })} />
          <Item icon={MessageCircle} label="Mensagens" description="Receber notificações de novas mensagens" action="switch"
            value={settings.notifications.messages}
            onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, messages: v } })} />
          <Item icon={Heart} label="Likes" description="Receber notificações quando alguém curtir você" action="switch"
            value={settings.notifications.likes}
            onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, likes: v } })} />
        </Section>

        <Section icon={Shield} title="Privacidade">
          <Item icon={MapPin} label="Mostrar Distância" description="Exibir distância no seu perfil" action="switch"
            value={settings.privacy.showDistance}
            onChange={(v) => setSettings({ ...settings, privacy: { ...settings.privacy, showDistance: v } })} />
          <Item icon={Eye} label="Mostrar Status Online" description="Permitir que outros vejam quando você está online" action="switch"
            value={settings.privacy.showOnline}
            onChange={(v) => setSettings({ ...settings, privacy: { ...settings.privacy, showOnline: v } })} />
          <Item icon={EyeOff} label="Modo Incógnito" description="Apenas pessoas que você curtir verão seu perfil" action="switch"
            value={settings.privacy.incognito}
            onChange={(v) => setSettings({ ...settings, privacy: { ...settings.privacy, incognito: v } })} />
        </Section>

        <Section icon={Heart} title="Descoberta">
          <Item icon={Eye} label="Mostrar-me no AngoTinder" description="Desative para pausar sua conta" action="switch"
            value={settings.discovery.showMe}
            onChange={(v) => setSettings({ ...settings, discovery: { ...settings.discovery, showMe: v } })} />
          <Item icon={MapPin} label="Modo Global" description="Veja pessoas de qualquer lugar (Premium)" action="switch"
            value={settings.discovery.globalMode}
            onChange={(v) => setSettings({ ...settings, discovery: { ...settings.discovery, globalMode: v } })} />
        </Section>

        <Section icon={Settings} title="Outros">
          <Item icon={CreditCard} label="Gerenciar Assinatura" action="navigate" />
          <Item icon={HelpCircle} label="Central de Ajuda" action="navigate" />
          <Item icon={Shield} label="Segurança e Privacidade" action="navigate" />
        </Section>

        <Button onClick={() => { logout(); navigate("/"); }} variant="outline"
          className="w-full h-14 border-4 border-primary/30 hover:border-primary hover:bg-primary/10 rounded-2xl font-black text-primary text-lg flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6 font-medium">AngoTinder v1.0.0</p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30">
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
