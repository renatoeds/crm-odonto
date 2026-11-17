import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppTopNav } from "@/components/AppTopNav";
import { AdminRoute } from "@/components/AdminRoute";

const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Settings = lazy(() => import("./pages/Settings"));
const Conversas = lazy(() => import("./pages/Conversas"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Pendentes = lazy(() => import("./pages/Pendentes"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Auditoria = lazy(() => import("./pages/Auditoria"));

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <div className="min-h-screen bg-white">
      <AppTopNav />
      <main className="min-w-0">{children}</main>
    </div>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white text-sm font-medium text-slate-600">Carregando CRM...</div>}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/conversas" replace />} />
            <Route path="/conversas" element={<ProtectedLayout><Conversas /></ProtectedLayout>} />
            <Route path="/pacientes" element={<ProtectedLayout><Pacientes /></ProtectedLayout>} />
            <Route path="/agenda" element={<ProtectedLayout><Agenda /></ProtectedLayout>} />
            <Route path="/pendentes" element={<ProtectedLayout><Pendentes /></ProtectedLayout>} />
            <Route path="/configuracoes" element={<ProtectedLayout><AdminRoute><Settings /></AdminRoute></ProtectedLayout>} />
            <Route path="/usuarios" element={<ProtectedLayout><AdminRoute><Usuarios /></AdminRoute></ProtectedLayout>} />
            <Route path="/auditoria" element={<ProtectedLayout><AdminRoute><Auditoria /></AdminRoute></ProtectedLayout>} />
            <Route path="/perfil" element={<ProtectedLayout><Perfil /></ProtectedLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
