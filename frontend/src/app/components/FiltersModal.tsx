import { useState } from "react";
import { motion } from "motion/react";
import { X, Sliders, MapPin, User } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { AfricanPattern } from "./AfricanPatterns";

export interface Filters {
  ageRange: [number, number];
  distance: number;
  showVerifiedOnly: boolean;
  gender: "all" | "women" | "men";
}

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: Filters) => void;
  initial?: Filters;
}

export function FiltersModal({ isOpen, onClose, onApply, initial }: FiltersModalProps) {
  const [filters, setFilters] = useState<Filters>(
    initial || { ageRange: [18, 35], distance: 50, showVerifiedOnly: false, gender: "all" }
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-gradient-to-br from-[#FFFBF0] to-[#FFE4B5] rounded-3xl shadow-2xl overflow-hidden">
          <AfricanPattern className="absolute top-0 right-0 w-64 h-64 text-primary opacity-5" />

          <div className="relative bg-gradient-to-r from-[#CE1126] via-[#8B0000] to-black p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-secondary to-[#FFD700] p-2 rounded-xl">
                  <Sliders className="w-6 h-6 text-black" />
                </div>
                <h2 className="text-2xl font-black">Filtros</h2>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-secondary mt-2 font-bold">Personalize sua busca</p>
          </div>

          <div className="p-6 space-y-8 relative z-10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <label className="font-black text-lg">Idade</label>
                </div>
                <span className="text-lg font-black text-primary">{filters.ageRange[0]} - {filters.ageRange[1]} anos</span>
              </div>
              <Slider
                value={filters.ageRange}
                onValueChange={(v) => setFilters({ ...filters, ageRange: v as [number, number] })}
                min={18} max={80} step={1}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <label className="font-black text-lg">Distância Máxima</label>
                </div>
                <span className="text-lg font-black text-primary">{filters.distance} km</span>
              </div>
              <Slider
                value={[filters.distance]}
                onValueChange={(v) => setFilters({ ...filters, distance: v[0] })}
                min={1} max={150} step={1}
              />
            </div>

            <div>
              <label className="block font-black text-lg mb-4">Mostrar-me</label>
              <div className="grid grid-cols-3 gap-3">
                {[{ value: "all", label: "Todos" }, { value: "women", label: "Mulheres" }, { value: "men", label: "Homens" }].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters({ ...filters, gender: opt.value as Filters["gender"] })}
                    className={`p-4 rounded-2xl font-black text-base transition-all border-4 ${
                      filters.gender === opt.value
                        ? "bg-gradient-to-br from-primary to-[#8B0000] text-white border-secondary shadow-lg scale-105"
                        : "bg-white border-primary/20 text-foreground hover:border-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-white rounded-2xl border-4 border-secondary/30">
              <div>
                <p className="font-black text-lg">Apenas Verificados</p>
                <p className="text-sm text-muted-foreground font-medium">Mostrar apenas perfis verificados</p>
              </div>
              <Switch
                checked={filters.showVerifiedOnly}
                onCheckedChange={(c) => setFilters({ ...filters, showVerifiedOnly: c })}
              />
            </div>
          </div>

          <div className="p-6 pt-0 relative z-10">
            <Button
              onClick={() => { onApply(filters); onClose(); }}
              className="w-full h-16 bg-gradient-to-r from-primary via-[#8B0000] to-black hover:opacity-90 text-white font-black text-lg rounded-2xl shadow-xl border-4 border-secondary/50"
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
