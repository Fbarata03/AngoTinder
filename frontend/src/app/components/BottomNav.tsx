import { MessageCircle, Users, Phone, Settings } from "lucide-react";
import { useNavigate } from "react-router";

type ActivePage = "chats" | "contacts" | "calls" | "settings";

interface BottomNavProps {
  active: ActivePage;
  chatBadge?: string;
  className?: string;
}

export function BottomNav({ active, chatBadge, className = "" }: BottomNavProps) {
  const navigate = useNavigate();

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-card/98 backdrop-blur-xl border-t border-border z-30 nav-safe ${className}`}>
      <div className="max-w-4xl mx-auto px-2 py-2 flex items-center justify-around">
        <NavBtn
          icon={<MessageCircle className="w-6 h-6" />}
          label="Chats"
          onClick={() => navigate("/chat")}
          active={active === "chats"}
          badge={chatBadge}
        />
        <NavBtn
          icon={<Users className="w-6 h-6" />}
          label="Contactos"
          onClick={() => navigate("/contacts")}
          active={active === "contacts"}
        />
        <NavBtn
          icon={<Phone className="w-6 h-6" />}
          label="Chamadas"
          onClick={() => navigate("/calls")}
          active={active === "calls"}
        />
        <NavBtn
          icon={<Settings className="w-6 h-6" />}
          label="Definições"
          onClick={() => navigate("/settings")}
          active={active === "settings"}
        />
      </div>
    </div>
  );
}

function NavBtn({
  icon, label, onClick, active, badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-primary"
      }`}
    >
      <div className="relative">
        {icon}
        {badge && (
          <div className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-primary rounded-full border-2 border-card flex items-center justify-center">
            <span className="text-[9px] font-black text-white leading-none">{badge}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
