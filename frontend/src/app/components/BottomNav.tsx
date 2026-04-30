import { Heart, MessageCircle, User, Compass, Star } from "lucide-react";
import { useNavigate } from "react-router";

type ActivePage = "discover" | "explore" | "chat" | "likes" | "profile";

interface BottomNavProps {
  active: ActivePage;
  likesBadge?: string;
  chatBadge?: string;
  className?: string;
}

export function BottomNav({ active, likesBadge, chatBadge, className = "" }: BottomNavProps) {
  const navigate = useNavigate();

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t-4 border-secondary/30 z-30 nav-safe ${className}`}>
      <div className="max-w-4xl mx-auto px-1 py-3 flex items-center justify-around">
        <NavBtn
          icon={<Heart className="w-5 h-5" />}
          label="Descobrir"
          onClick={() => navigate("/discover")}
          active={active === "discover"}
        />
        <NavBtn
          icon={<Compass className="w-5 h-5" />}
          label="Explorar"
          onClick={() => navigate("/search")}
          active={active === "explore"}
        />
        <NavBtn
          icon={<MessageCircle className="w-5 h-5" />}
          label="Chat"
          onClick={() => navigate("/chat")}
          active={active === "chat"}
          badge={chatBadge}
        />
        <NavBtn
          icon={<Star className="w-5 h-5" />}
          label="Likes"
          onClick={() => navigate("/likes")}
          active={active === "likes"}
          badge={likesBadge}
        />
        <NavBtn
          icon={<User className="w-5 h-5" />}
          label="Perfil"
          onClick={() => navigate("/profile")}
          active={active === "profile"}
        />
      </div>
    </div>
  );
}

function NavBtn({
  icon,
  label,
  onClick,
  active,
  badge,
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
      className={`flex flex-col items-center gap-1 transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-primary"
      }`}
    >
      <div
        className={`p-2 rounded-2xl relative transition-colors ${
          active ? "bg-gradient-to-br from-primary/20 to-secondary/20" : "hover:bg-secondary/10"
        }`}
      >
        {icon}
        {badge && (
          <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-gradient-to-br from-primary to-[#8B0000] rounded-full border-2 border-card flex items-center justify-center">
            <span className="text-[9px] font-black text-white leading-none">{badge}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] font-black">{label}</span>
    </button>
  );
}
