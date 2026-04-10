import { createBrowserRouter } from "react-router";
import { TelaInicial } from "./components/TelaInicial";
import { TelaRegisto } from "./components/TelaRegisto";
import { TelaPerfil } from "./components/TelaPerfil";
import { TelaDescoberta } from "./components/TelaDescoberta";
import { TelaChat } from "./components/TelaChat";
import { TelaLikes } from "./components/TelaLikes";
import { TelaTopPicks } from "./components/TelaTopPicks";
import { TelaConfiguracoes } from "./components/TelaConfiguracoes";
import { TelaAdmin } from "./components/TelaAdmin";

export const router = createBrowserRouter([
  { path: "/", Component: TelaInicial },
  { path: "/register", Component: TelaRegisto },
  { path: "/profile", Component: TelaPerfil },
  { path: "/discover", Component: TelaDescoberta },
  { path: "/chat", Component: TelaChat },
  { path: "/likes", Component: TelaLikes },
  { path: "/top-picks", Component: TelaTopPicks },
  { path: "/settings", Component: TelaConfiguracoes },
  { path: "/admin", Component: TelaAdmin },
]);
