import { Link, useLocation } from "react-router-dom";
import {
  BellDot,
  CalendarDays,
  ContactRound,
  ChevronDown,
  ClipboardList,
  LogOut,
  CircleUserRound,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useClinicIdentity } from "@/hooks/useClinicIdentity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NavLink = ({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Users;
}) => {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-50 text-emerald-800"
          : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
};

export function AppTopNav() {
  const { clinicName } = useClinicIdentity();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const metadataName = user?.user_metadata?.full_name;
  const displayName = (typeof metadataName === "string" ? metadataName.trim() : "") || user?.email?.split("@")[0] || "Equipe";
  const initials = displayName
    .split("@")[0]
    .split(/[._ -]+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-background/95 shadow-[0_1px_8px_rgba(16,44,34,0.04)] backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1480px] flex-wrap items-center gap-x-5 gap-y-0 px-4 py-2 md:flex-nowrap md:px-7 md:py-0">
        <Link to="/conversas" className="flex shrink-0 items-center" aria-label="AE CRM — início">
          <img src="/brand/ae-crm-logo.svg" alt="AE CRM" className="h-10 w-auto max-w-[170px]" />
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto py-2 md:order-none md:w-auto md:overflow-visible md:py-0" aria-label="Navegação principal">
          <NavLink to="/conversas" label="Conversas" icon={MessagesSquare} />
          <NavLink to="/pendentes" label="Pendentes" icon={BellDot} />
          <NavLink to="/agenda" label="Agenda" icon={CalendarDays} />
          <NavLink to="/pacientes" label="Pacientes" icon={ContactRound} />
          {isAdmin && <NavLink to="/usuarios" label="Equipe" icon={Users} />}
          {isAdmin && <NavLink to="/auditoria" label="Auditoria" icon={ClipboardList} />}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex shrink-0 items-center gap-2 rounded-xl p-1.5 text-left outline-none hover:bg-emerald-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E2A47] text-xs font-bold text-white">
              {initials}
            </span>
            <span className="hidden max-w-36 lg:block">
              <strong className="block truncate text-xs text-slate-800">{displayName}</strong>
              <small className="block text-[11px] text-slate-600">{isAdmin ? "Administrador" : "Equipe"}</small>
            </span>
            <ChevronDown className="hidden h-3 w-3 text-slate-500 lg:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>{clinicName}</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/perfil"><CircleUserRound className="mr-2 h-4 w-4" />Meu perfil</Link></DropdownMenuItem>
            {isAdmin && <DropdownMenuItem asChild><Link to="/configuracoes"><Settings className="mr-2 h-4 w-4" />Configurações</Link></DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
