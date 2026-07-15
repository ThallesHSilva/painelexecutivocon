import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Smartphone,
  Wifi,
  Boxes,
  Gauge,
  Table2,
  ShieldCheck,
  Menu,
  Sun,
  Moon,
  Download,
  RefreshCw,
  Info,
  CircleDot,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/contexts/AppContexts";
import { PartnerFilter } from "@/components/PartnerFilter";
import { META_INFO } from "@/services/api";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/movel", label: "Oportunidades Móvel", icon: Smartphone },
  { to: "/ftth", label: "Oportunidades FTTH", icon: Wifi },
  { to: "/licencas", label: "Licenças e Serviços Digitais", icon: Boxes },
  { to: "/capacidade", label: "Capacidade Comercial", icon: Gauge },
  { to: "/carteira", label: "Carteira Detalhada", icon: Table2 },
  { to: "/qualidade", label: "Qualidade da Base", icon: ShieldCheck },
] as const;

function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-5">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-elegant">
        <span className="text-lg font-bold leading-none">v</span>
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight tracking-tight">Mapa Parque</div>
          <div className="truncate text-[11px] text-muted-foreground">Visão de Oportunidades</div>
        </div>
      )}
    </div>
  );
}

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <TooltipProvider delayDuration={100}>
      <nav className="flex flex-col gap-1 px-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          const content = (
            <Link
              to={item.to}
              onClick={onNavigate}
              className={
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition " +
                (active
                  ? "bg-gradient-brand font-medium text-primary-foreground shadow-elegant"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")
              }
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div key={item.to}>{content}</div>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <BrandMark collapsed={collapsed} />
      <div className="mt-1 flex-1 overflow-y-auto pb-4">
        <NavItems collapsed={collapsed} />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onToggle}
          className="hidden w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted-foreground hover:bg-sidebar-accent md:flex"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronLeft className={"size-4 transition " + (collapsed ? "rotate-180" : "")} />
          {!collapsed && <span>Recolher</span>}
        </button>
        {!collapsed && (
          <div className="mt-3 rounded-lg border bg-card/50 px-3 py-2 text-[11px] leading-tight text-muted-foreground">
            <span className="font-medium text-foreground">Logo Vivo</span>
            <br />
            Espaço reservado para a marca oficial.
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessingInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="hidden items-center gap-1.5 rounded-lg border bg-card/50 px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:bg-accent md:flex">
          <Info className="size-3.5" />
          <span>Dados processados com regras comerciais fixas</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-xl text-xs">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-md text-[10px]">
            somente leitura
          </Badge>
        </div>
        <dl className="space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Versão das regras</dt>
            <dd className="font-medium tabular-nums">{META_INFO.regrasVersao}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Processado em</dt>
            <dd className="font-medium tabular-nums">{META_INFO.processadoEm}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Data-base</dt>
            <dd className="font-medium tabular-nums">{META_INFO.dataBase}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Registros processados</dt>
            <dd className="font-medium tabular-nums">{META_INFO.registrosProcessados.toLocaleString("pt-BR")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-success">{META_INFO.status}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Regras de elegibilidade e classificação são aplicadas exclusivamente no backend e não podem ser
          alteradas na interface.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function Header({ onMenu, title }: { onMenu: () => void; title: string }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 md:gap-3 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="size-3" />
              Atualizado em {META_INFO.processadoEm}
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleDot className="size-3 text-success" />
              Online
            </span>
            <Badge variant="secondary" className="rounded-md text-[10px]">
              Dados demonstrativos
            </Badge>
          </div>
        </div>
        <div className="hidden md:block">
          <ProcessingInfo />
        </div>
        <PartnerFilter />
        <Button variant="outline" size="icon" aria-label="Exportar" className="rounded-xl">
          <Download className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
          onClick={toggle}
          className="rounded-xl"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}

export function DashboardLayout({ title, children }: { title: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:block " +
          (collapsed ? "w-[72px]" : "w-[260px]")
        }
      >
        <div className="sticky top-0 h-screen">
          <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <span className="sr-only">Abrir navegação</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
          <SidebarContent collapsed={false} onToggle={() => {}} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <Header onMenu={() => setDrawerOpen(true)} title={title} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
