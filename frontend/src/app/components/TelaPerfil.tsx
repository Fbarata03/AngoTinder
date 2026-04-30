import { useState, useEffect, useRef } from "react";
import { Camera, User, LogOut, Sparkles, MapPin, Star, Settings, Trash2, ChevronDown, X, EyeOff, Users } from "lucide-react";
import { ANGOLA_PROVINCES } from "./TelaRegisto";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { BottomNav } from "./BottomNav";
import { profilesApi, socialApi, resolveMediaUrl, User as UserType } from "../api";
import { useApp } from "../context";

export function TelaPerfil() {
  const navigate = useNavigate();
  const { currentUser, isLoggedIn, logout, updateUser } = useApp();
  const [profile, setProfile] = useState<UserType | null>(currentUser);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [interestInput, setInterestInput] = useState("");
  const [socialStats, setSocialStats] = useState<{ followers: number; following: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/"); return; }
    if (currentUser) setProfile(currentUser);
  }, [currentUser, isLoggedIn]);

  useEffect(() => {
    if (!currentUser?.id) return;
    socialApi.getStats(currentUser.id)
      .then((s) => setSocialStats({ followers: s.followers, following: s.following }))
      .catch(() => {});
  }, [currentUser?.id]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await profilesApi.updateProfile({
        name: profile.name,
        age: profile.age,
        location: profile.location,
        work: profile.work,
        bio: profile.bio,
        education: profile.education,
        hometown: profile.hometown,
        interests: profile.interests,
        incognito_mode: profile.incognito_mode ?? 0,
      });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const res = await profilesApi.uploadPhoto(file);
      const updated = { ...profile, photos: res.photos };
      setProfile(updated);
      updateUser(updated);
    } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (url: string) => {
    if (!profile) return;
    try {
      const res = await profilesApi.deletePhoto(url);
      const updated = { ...profile, photos: res.photos };
      setProfile(updated);
      updateUser(updated);
    } catch { /* ignore */ }
  };

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#FFFBF0] via-[#FFF8E1] to-[#FFE4B5] dark:from-[#0b0b10] dark:via-[#101018] dark:to-[#1a1406] relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <AfricanPattern className="absolute top-0 right-0 w-96 h-96 text-primary opacity-5" />
        <AfricanPattern className="absolute bottom-0 left-0 w-96 h-96 text-secondary opacity-5" />
      </div>

      <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white shadow-xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
              <User className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Meu Perfil</h1>
              {socialStats ? (
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span className="text-secondary font-black">{socialStats.followers}</span> seguidores
                  </span>
                  <span className="text-white/60 text-xs">·</span>
                  <span className="text-white/80 text-xs font-bold">
                    <span className="text-secondary font-black">{socialStats.following}</span> a seguir
                  </span>
                </div>
              ) : (
                <p className="text-secondary text-sm font-bold">Edite suas informações</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-white hover:bg-white/20 rounded-xl p-2" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" className="text-white hover:bg-white/20 rounded-xl p-2" onClick={() => { logout(); navigate("/"); }}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 pb-32 relative z-10">
        {profile.is_verified === 1 && (
          <div className="mb-8 bg-gradient-to-r from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-2xl">
            <div className="bg-card p-6 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-primary to-[#8B0000] p-4 rounded-2xl">
                  <Star className="w-8 h-8 text-secondary fill-secondary" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-primary">Perfil Verificado</h3>
                  <p className="text-sm text-muted-foreground">Você é um membro premium</p>
                </div>
              </div>
              <Sparkles className="w-8 h-8 text-secondary animate-pulse" />
            </div>
          </div>
        )}

        {/* Fotos */}
        <div className="mb-8">
          <label className="block mb-4 flex items-center gap-2">
            <span className="text-lg font-black">Suas Fotos</span>
            <span className="text-sm text-muted-foreground">(Adicione até 6 fotos)</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {profile.photos.map((photo, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10 relative group border-4 border-secondary/30 hover:border-secondary transition-all">
                <img src={resolveMediaUrl(photo)} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDeletePhoto(photo)}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
            {profile.photos.length < 6 && (
              <label
                htmlFor="profilePhotoInput"
                className={`aspect-square rounded-2xl bg-gradient-to-br from-secondary/20 to-[#FFD700]/20 border-4 border-dashed border-secondary/50 flex flex-col items-center justify-center hover:border-secondary hover:from-secondary/30 hover:to-[#FFD700]/30 transition-all cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                <Camera className="w-10 h-10 text-primary mb-2" />
                <span className="text-sm font-bold text-primary">{uploading ? "A enviar..." : "Adicionar"}</span>
              </label>
            )}
          </div>
          <input
            id="profilePhotoInput"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg">Nome</label>
          <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5"
            placeholder="Seu nome" />
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg">Idade</label>
          <Input type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || profile.age })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5"
            placeholder="Sua idade" />
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Localização
          </label>
          <div className="relative">
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50 pointer-events-none" />
            <select
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              className="w-full bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5 pr-10 appearance-none cursor-pointer"
            >
              {ANGOLA_PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg">Profissão</label>
          <Input value={profile.work || ""} onChange={(e) => setProfile({ ...profile, work: e.target.value })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5"
            placeholder="Ex: Engenheiro, Professor..." />
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg">Educação</label>
          <Input value={profile.education || ""} onChange={(e) => setProfile({ ...profile, education: e.target.value })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5"
            placeholder="Ex: Universidade Agostinho Neto..." />
        </div>

        <div className="mb-6">
          <label className="block mb-3 font-black text-lg">Cidade natal</label>
          <Input value={profile.hometown || ""} onChange={(e) => setProfile({ ...profile, hometown: e.target.value })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-16 rounded-2xl text-lg font-bold pl-5"
            placeholder="Ex: Luanda, Benguela..." />
        </div>

        <div className="mb-8">
          <label className="block mb-3 font-black text-lg">Sobre Mim</label>
          <Textarea value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary rounded-2xl min-h-40 resize-none text-base p-5 font-medium"
            placeholder="Conte um pouco sobre você..." />
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-muted-foreground font-bold">{(profile.bio || "").length}/500 caracteres</p>
            <Sparkles className="w-4 h-4 text-secondary" />
          </div>
        </div>

        <div className="mb-8">
          <label className="block mb-3 font-black text-lg">Interesses <span className="text-sm text-muted-foreground font-normal">({(profile.interests || []).length}/10)</span></label>
          <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-input-background rounded-2xl border-4 border-black/10 dark:border-white/15 mb-3">
            {(profile.interests || []).map((interest) => (
              <span key={interest} className="inline-flex items-center gap-1 px-3 py-1.5 bg-secondary/20 text-primary rounded-xl text-sm font-bold border-2 border-secondary/30">
                {interest}
                <button type="button" onClick={() => setProfile({ ...profile, interests: (profile.interests || []).filter((i) => i !== interest) })}
                  className="text-primary/60 hover:text-primary ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(profile.interests || []).length === 0 && (
              <span className="text-muted-foreground text-sm font-medium self-center">Nenhum interesse adicionado</span>
            )}
          </div>
          <Input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && interestInput.trim()) {
                e.preventDefault();
                const val = interestInput.trim().replace(/,$/, "");
                const current = profile.interests || [];
                if (val && !current.includes(val) && current.length < 10) {
                  setProfile({ ...profile, interests: [...current, val] });
                }
                setInterestInput("");
              }
            }}
            placeholder="Escreve um interesse e prime Enter..."
            className="bg-input-background border-4 border-black/10 dark:border-white/15 focus:border-secondary h-12 rounded-2xl font-medium pl-5 mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {["Música","Desporto","Viagens","Cozinha","Cinema","Arte","Leitura","Dança","Gaming","Natureza","Fotografia","Moda"]
              .filter((s) => !(profile.interests || []).includes(s))
              .slice(0, 8)
              .map((s) => (
                <button key={s} type="button"
                  onClick={() => {
                    const current = profile.interests || [];
                    if (current.length < 10) setProfile({ ...profile, interests: [...current, s] });
                  }}
                  className="px-3 py-1 bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-primary rounded-xl text-xs font-bold border-2 border-secondary/20 transition-all">
                  + {s}
                </button>
              ))}
          </div>
        </div>

        {/* Modo Incógnito */}
        <div className="mb-8 p-5 bg-card rounded-2xl border-4 border-black/10 dark:border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 dark:bg-gray-700 p-2 rounded-xl">
              <EyeOff className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-base">Modo Incógnito</p>
              <p className="text-sm text-muted-foreground font-medium">
                {(profile.incognito_mode ?? 0) === 1
                  ? "Só apareces para quem curtiste"
                  : "Visível para todos na descoberta"}
              </p>
            </div>
          </div>
          <Switch
            checked={(profile.incognito_mode ?? 0) === 1}
            onCheckedChange={(c) => setProfile({ ...profile, incognito_mode: c ? 1 : 0 })}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}
          className="w-full h-16 bg-gradient-to-r from-primary via-[#8B0000] to-black hover:opacity-90 text-white rounded-2xl font-black text-lg shadow-2xl shadow-primary/30 border-4 border-secondary/50">
          {saving ? "A guardar..." : saved ? "✓ Guardado!" : "Salvar Alterações"}
        </Button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
