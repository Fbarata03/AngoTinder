import { Heart, Sparkles, Mail, Lock, User, MapPin, Briefcase, Eye, EyeOff, ChevronDown, Camera, X } from "lucide-react";

export const ANGOLA_PROVINCES = [
  "Cabinda",
  "Zaire",
  "Uíge",
  "Bengo",
  "Luanda",
  "Icolo e Bengo",
  "Cuanza Norte",
  "Cuanza Sul",
  "Malanje",
  "Lunda Norte",
  "Lunda Sul",
  "Moxico",
  "Moxico Leste",
  "Bié",
  "Huambo",
  "Benguela",
  "Namibe",
  "Huíla",
  "Cunene",
  "Cubango",
  "Cuando",
];
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useNavigate } from "react-router";
import { AfricanPattern } from "./AfricanPatterns";
import { motion } from "motion/react";
import { useApp } from "../context";
import { profilesApi } from "../api";
import { useState, useRef } from "react";

export function TelaRegisto() {
  const navigate = useNavigate();
  const { register } = useApp();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    age: "",
    location: "Luanda",
    gender: "other",
    looking_for: "all",
    bio: "",
    work: "",
  });

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAndFinish = async () => {
    if (!photoFile) { navigate("/discover"); return; }
    setUploadingPhoto(true);
    try { await profilesApi.uploadPhoto(photoFile); } catch { /* ignore */ }
    setUploadingPhoto(false);
    navigate("/discover");
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!form.email.trim() || !form.password.trim()) return setError("Preencha todos os campos");
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) return setError("Email inválido");
      if (form.password.length < 6) return setError("A senha deve ter pelo menos 6 caracteres");
    }
    if (step === 2) {
      if (!form.name.trim()) return setError("Nome é obrigatório");
      const age = parseInt(form.age);
      if (!form.age || isNaN(age) || age < 18 || age > 99) return setError("Idade deve ser entre 18 e 99");
      if (!form.location.trim()) return setError("Localização é obrigatória");
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        age: parseInt(form.age),
        location: form.location.trim(),
        gender: form.gender,
        looking_for: form.looking_for,
        bio: form.bio.trim(),
        work: form.work.trim(),
      });
      setAccountCreated(true);
      setStep(4);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(msg);
        const detail = parsed.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail) && detail.length > 0) {
          // FastAPI validation error: [{ loc, msg, type }]
          setError(detail[0]?.msg || "Erro de validação");
        } else {
          setError("Erro ao criar conta");
        }
      } catch {
        if (msg.includes("409") || msg.toLowerCase().includes("already")) {
          setError("Este email já está registado.");
        } else {
          setError("Erro ao criar conta. Tente novamente.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-[#000000]">
      <div className="absolute inset-0 opacity-10">
        <AfricanPattern className="absolute top-0 left-0 w-96 h-96 text-secondary" />
        <AfricanPattern className="absolute bottom-0 right-0 w-96 h-96 text-secondary" />
      </div>

      <div className="relative min-h-[100dvh] flex flex-col px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => (step === 1 ? navigate("/") : step === 4 ? null : setStep((s) => s - 1))}
            className={`text-white/70 hover:text-white font-bold ${step === 4 ? "invisible" : ""}`}
          >
            ← Voltar
          </button>
          <div className="flex-1 flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? "bg-secondary" : "bg-white/20"}`}
              />
            ))}
          </div>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md mx-auto w-full"
        >
          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <Heart className="w-12 h-12 text-secondary fill-secondary mx-auto mb-4" />
                <h1 className="text-3xl font-black text-white">Criar conta</h1>
                <p className="text-white/60 mt-2">Comece a encontrar a sua pessoa</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="Email"
                    className="pl-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Senha (mín. 6 caracteres)"
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
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center mb-8">
                <Sparkles className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h1 className="text-3xl font-black text-white">O seu perfil</h1>
                <p className="text-white/60 mt-2">Conte-nos sobre você</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Nome completo"
                    className="pl-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                  />
                </div>

                <Input
                  type="number"
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  placeholder="Idade"
                  min={18}
                  max={99}
                  className="h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base px-5"
                />

                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60 z-10" />
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60 z-10 pointer-events-none" />
                  <select
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    className="w-full pl-12 pr-10 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white rounded-2xl text-base appearance-none cursor-pointer"
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p} value={p} className="bg-black text-white">{p}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/60" />
                  <Input
                    value={form.work}
                    onChange={(e) => set("work", e.target.value)}
                    placeholder="Profissão (opcional)"
                    className="pl-12 h-14 bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-center mb-8">
                <Heart className="w-12 h-12 text-secondary fill-secondary mx-auto mb-4" />
                <h1 className="text-3xl font-black text-white">Preferências</h1>
                <p className="text-white/60 mt-2">Quem você quer conhecer?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-white/80 text-sm font-bold mb-2 block">Género</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "male", l: "Homem" },
                      { v: "female", l: "Mulher" },
                      { v: "other", l: "Outro" },
                    ].map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => set("gender", v)}
                        className={`py-3 rounded-2xl font-bold text-sm transition-all ${
                          form.gender === v
                            ? "bg-secondary text-black"
                            : "bg-white/10 text-white border-2 border-white/20 hover:border-secondary/50"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-white/80 text-sm font-bold mb-2 block">Procuro</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "women", l: "Mulheres" },
                      { v: "men", l: "Homens" },
                      { v: "all", l: "Todos" },
                    ].map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => set("looking_for", v)}
                        className={`py-3 rounded-2xl font-bold text-sm transition-all ${
                          form.looking_for === v
                            ? "bg-secondary text-black"
                            : "bg-white/10 text-white border-2 border-white/20 hover:border-secondary/50"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-white/80 text-sm font-bold mb-2 block">Sobre mim (opcional)</label>
                  <Textarea
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="Conte algo sobre você..."
                    rows={3}
                    className="bg-white/10 border-2 border-secondary/30 focus:border-secondary text-white placeholder:text-white/40 rounded-2xl text-base px-5 py-4 resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Passo 4: Foto ── */}
          {step === 4 && accountCreated && (
            <>
              <div className="text-center mb-8">
                <Camera className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h1 className="text-3xl font-black text-white">Adiciona a tua foto</h1>
                <p className="text-white/60 mt-2">Perfis com foto têm 10x mais matches!</p>
              </div>
              <div className="flex flex-col items-center gap-6">
                <button onClick={() => fileRef.current?.click()}
                  className="relative w-52 h-52 rounded-3xl overflow-hidden border-4 border-secondary/50 hover:border-secondary transition-all bg-white/10 flex items-center justify-center">
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt="foto" className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setPhotoFile(null); }}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-secondary/60 mx-auto mb-2" />
                      <p className="text-white/60 text-sm font-bold">Toca para escolher</p>
                    </div>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <Button onClick={handleUploadAndFinish} disabled={uploadingPhoto}
                  className="w-full h-14 bg-gradient-to-r from-secondary to-[#FFD700] text-black text-lg rounded-2xl font-black shadow-xl">
                  {uploadingPhoto ? "A carregar..." : photoFile ? "Guardar e entrar" : "Entrar sem foto →"}
                </Button>
                {!photoFile && (
                  <p className="text-white/40 text-xs text-center">Podes adicionar fotos mais tarde no perfil</p>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center font-medium mt-4">{error}</p>
          )}

          {step < 4 && (
            <div className="mt-8">
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  className="w-full h-14 bg-gradient-to-r from-secondary to-[#FFD700] text-black text-lg rounded-2xl font-black shadow-xl"
                >
                  Continuar →
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full h-14 bg-gradient-to-r from-secondary to-[#FFD700] text-black text-lg rounded-2xl font-black shadow-xl"
                >
                  {loading ? "A criar conta..." : "Criar conta"}
                </Button>
              )}
            </div>
          )}

          {step === 1 && (
            <p className="text-center text-white/50 text-sm mt-4">
              Já tem conta?{" "}
              <button onClick={() => navigate("/")} className="text-secondary font-black hover:underline">
                Entrar
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
