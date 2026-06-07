import { Component, ReactNode } from "react";
import { Heart } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Erro desconhecido" };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#CE1126] via-[#8B0000] to-black flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-gradient-to-br from-secondary via-[#FFD700] to-[#FFA500] p-1 rounded-3xl shadow-2xl max-w-sm w-full">
          <div className="bg-black rounded-3xl p-8">
            <Heart className="w-16 h-16 text-secondary fill-secondary mx-auto mb-4 drop-shadow-lg" />
            <h2 className="text-2xl font-black text-secondary mb-2">Algo correu mal</h2>
            <p className="text-white/60 text-sm mb-6">Ocorreu um erro inesperado. Tenta recarregar a página.</p>
            <button
              onClick={() => { window.location.href = "/discover"; }}
              className="w-full h-12 bg-gradient-to-r from-[#CE1126] to-[#8B0000] text-white font-black rounded-2xl hover:opacity-90 transition-opacity"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
