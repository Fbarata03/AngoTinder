import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router";
import { NotificationProvider } from "./components/NotificationProvider";
import { Heart } from "lucide-react";

// Lazy-load heavy route components — each becomes its own JS chunk
const TelaInicial       = lazy(() => import("./components/TelaInicial").then(m => ({ default: m.TelaInicial })));
const TelaRegisto       = lazy(() => import("./components/TelaRegisto").then(m => ({ default: m.TelaRegisto })));
const TelaPerfil        = lazy(() => import("./components/TelaPerfil").then(m => ({ default: m.TelaPerfil })));
const TelaDescoberta    = lazy(() => import("./components/TelaDescoberta").then(m => ({ default: m.TelaDescoberta })));
const TelaChat          = lazy(() => import("./components/TelaChat").then(m => ({ default: m.TelaChat })));
const TelaLikes         = lazy(() => import("./components/TelaLikes").then(m => ({ default: m.TelaLikes })));
const TelaTopPicks      = lazy(() => import("./components/TelaTopPicks").then(m => ({ default: m.TelaTopPicks })));
const TelaConfiguracoes = lazy(() => import("./components/TelaConfiguracoes").then(m => ({ default: m.TelaConfiguracoes })));
const TelaAdmin         = lazy(() => import("./components/TelaAdmin").then(m => ({ default: m.TelaAdmin })));

function RouteLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#CE1126] flex items-center justify-center">
      <Heart className="w-12 h-12 text-[#FFCD00] fill-[#FFCD00] animate-pulse" />
    </div>
  );
}

function RootLayout() {
  return (
    <NotificationProvider>
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </NotificationProvider>
  );
}

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { path: "/",           Component: TelaInicial },
      { path: "/register",   Component: TelaRegisto },
      { path: "/profile",    Component: TelaPerfil },
      { path: "/discover",   Component: TelaDescoberta },
      { path: "/chat",       Component: TelaChat },
      { path: "/likes",      Component: TelaLikes },
      { path: "/top-picks",  Component: TelaTopPicks },
      { path: "/settings",   Component: TelaConfiguracoes },
      { path: "/admin",      Component: TelaAdmin },
    ],
  },
]);
