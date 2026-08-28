import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChartNoAxesCombined,
  Smartphone,
  Wifi,
  Boxes,
  Rocket,
  ClipboardCheck,
  Award,
  Menu,
  Sun,
  Moon,
  Download,
  Upload,
  ChevronDown,
  BriefcaseBusiness,
  LogOut,
  LoaderCircle,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/contexts/AppContexts";
import { PartnerFilter } from "@/components/PartnerFilter";

const PRIMARY_NAV = [
  { to: "/resultados", label: "Visão resultado", icon: ChartNoAxesCombined },
  { to: "/certificacao", label: "Certificação", icon: Award },
] as const;

const OPPORTUNITY_NAV = [
  { to: "/movel", label: "Oportunidades Móvel", icon: Smartphone },
  { to: "/ftth", label: "Oportunidades FTTH", icon: Wifi },
  { to: "/licencas", label: "Licenças e Serviços Digitais", icon: Boxes },
  { to: "/avancada", label: "Oportunidade Avançada", icon: Rocket },
] as const;

const SECONDARY_NAV = [{ to: "/qsc", label: "QSC", icon: ClipboardCheck }] as const;
const DATA_NAV = { to: "/alimentacao", label: "Alimentar dados", icon: Upload } as const;
const ADMIN_NAV = { to: "/usuarios", label: "Acessos", icon: UserCog } as const;

const VIVO_LOGO_DATA_URL =
  "data:image/webp;base64,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";

const VIVO_EMPRESAS_LOGO_DATA_URL =
  "data:image/png;base64,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";

function NavItems({
  mobile = false,
  onNavigate,
  role = null,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  role?: "admin" | "director" | "gn" | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const opportunitiesActive = OPPORTUNITY_NAV.some((item) => pathname === item.to);
  const navLink = (
    item:
      | (typeof PRIMARY_NAV)[number]
      | (typeof OPPORTUNITY_NAV)[number]
      | (typeof SECONDARY_NAV)[number]
      | typeof DATA_NAV
      | typeof ADMIN_NAV,
    nested = false,
  ) => {
    const Icon = item.icon;
    const active = pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={
          `group relative flex items-center rounded-xl text-sm transition ${nested ? "gap-3 px-3 py-2.5" : mobile ? "gap-3 px-3 py-3" : "gap-2 px-3 py-2"} ` +
          (active
            ? "bg-gradient-brand font-medium text-primary-foreground shadow-elegant"
            : nested
              ? "text-foreground/75 hover:bg-primary/[0.07] hover:text-foreground"
              : "text-foreground/75 hover:bg-primary/[0.06] hover:text-foreground")
        }
      >
        <Icon className="size-[17px] shrink-0" />
        <span className="whitespace-nowrap">{item.label}</span>
      </Link>
    );
  };

  if (role === "admin") {
    return (
      <nav className={mobile ? "grid gap-1.5 p-3" : "flex items-center"}>{navLink(ADMIN_NAV)}</nav>
    );
  }

  if (mobile) {
    return (
      <nav className="grid gap-1.5 p-3" aria-label="Navegação principal">
        {PRIMARY_NAV.slice(0, 1).map((item) => navLink(item))}
        <div className="my-1 rounded-2xl border border-primary/10 bg-primary/[0.025] p-2">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
            <BriefcaseBusiness className="size-4" />
            Oportunidades carteira
          </div>
          <div className="grid gap-1">{OPPORTUNITY_NAV.map((item) => navLink(item, true))}</div>
        </div>
        {PRIMARY_NAV.slice(1).map((item) => navLink(item))}
        {SECONDARY_NAV.map((item) => navLink(item))}
        {role === "director" && navLink(ADMIN_NAV)}
        {navLink(DATA_NAV)}
      </nav>
    );
  }

  return (
    <nav className="flex min-w-max items-center gap-1" aria-label="Navegação principal">
      {PRIMARY_NAV.slice(0, 1).map((item) => navLink(item))}
      <div className="group/opportunities relative">
        <button
          type="button"
          aria-haspopup="menu"
          className={
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition " +
            (opportunitiesActive
              ? "bg-gradient-brand font-medium text-primary-foreground shadow-elegant"
              : "text-foreground/75 hover:bg-primary/[0.06] hover:text-foreground")
          }
        >
          <BriefcaseBusiness className="size-[17px]" />
          <span>Oportunidades carteira</span>
          <ChevronDown className="size-3.5 transition-transform duration-200 group-hover/opportunities:rotate-180 group-focus-within/opportunities:rotate-180" />
        </button>
        <div className="invisible absolute left-0 top-full z-50 w-[310px] translate-y-1 pt-2 opacity-0 transition duration-200 group-hover/opportunities:visible group-hover/opportunities:translate-y-0 group-hover/opportunities:opacity-100 group-focus-within/opportunities:visible group-focus-within/opportunities:translate-y-0 group-focus-within/opportunities:opacity-100">
          <div
            role="menu"
            className="grid gap-1 rounded-2xl border border-primary/15 bg-card/95 p-2 shadow-elevated backdrop-blur-xl"
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Selecione uma oportunidade
            </div>
            {OPPORTUNITY_NAV.map((item) => navLink(item, true))}
          </div>
        </div>
      </div>
      {PRIMARY_NAV.slice(1).map((item) => navLink(item))}
      {SECONDARY_NAV.map((item) => navLink(item))}
      {navLink(DATA_NAV)}
    </nav>
  );
}

function Header({
  onMenu,
  role,
}: {
  onMenu: () => void;
  role: "admin" | "director" | "gn" | null;
}) {
  const { theme, toggle } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/login");
    }
  };
  return (
    <header className="sticky top-0 z-30 border-b border-primary/10 bg-background/85 shadow-[0_10px_35px_-28px_hsl(var(--primary)/0.55)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <div className="relative mx-auto max-w-[1600px] px-4 md:px-6 xl:px-8">
        <div className="flex h-[68px] items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 2xl:hidden"
            onClick={onMenu}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="hidden min-w-0 flex-1 2xl:block">
            <NavItems role={role} />
          </div>
          <div className="flex-1 2xl:hidden" />
          {role !== "admin" && (
            <div className="hidden xl:block">
              <PartnerFilter />
            </div>
          )}
          {role !== "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-10 shrink-0 gap-2 rounded-2xl border-primary/15 bg-card/70 px-3 text-xs font-semibold shadow-sm transition hover:border-primary/30 hover:bg-primary/[0.06]"
              aria-label="Baixar material em PDF"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Baixar material</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            onClick={toggle}
            className="size-10 shrink-0 rounded-2xl border-border/80 bg-card/70 shadow-sm transition hover:border-primary/20 hover:bg-primary/[0.06]"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {(role === "admin" || role === "director") && (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-2xl border-primary/15 bg-card/70 text-primary shadow-sm"
            >
              <Link to="/usuarios" aria-label="Gerenciar acessos" title="Gerenciar acessos">
                <UserCog className="size-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            disabled={signingOut}
            className="h-10 shrink-0 gap-2 rounded-2xl px-3 text-xs font-semibold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
            aria-label="Sair do painel"
          >
            {signingOut ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            <span className="hidden xl:inline">Sair</span>
          </Button>
        </div>
        {role !== "admin" && (
          <div className="pb-2 xl:hidden">
            <PartnerFilter />
          </div>
        )}
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { title: string; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "director" | "gn" | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session: { user?: { role?: "admin" | "director" | "gn" } }) =>
        setRole(session.user?.role ?? null),
      )
      .catch(() => setRole(null));
  }, []);

  return (
    <div className="min-h-screen w-full bg-background">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <span className="sr-only">Abrir navegação</span>
        </SheetTrigger>
        <SheetContent
          side="top"
          className="max-h-[90vh] overflow-y-auto border-b border-primary/15 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação principal</SheetTitle>
          </SheetHeader>
          <NavItems mobile role={role} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <Header role={role} onMenu={() => setDrawerOpen(true)} />
      <main className="mx-auto max-w-[1600px] px-4 py-5 md:px-6 md:py-7 xl:px-8 xl:py-8">
        {children}
      </main>
    </div>
  );
}
