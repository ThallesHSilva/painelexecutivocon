import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "admin" | "director" | "gn";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — Mapa Parque" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

function safeRedirect() {
  if (typeof window === "undefined") return "/resultados";
  const destination = new URLSearchParams(window.location.search).get("redirect");
  return destination?.startsWith("/") && !destination.startsWith("//") && destination !== "/login"
    ? destination
    : "/resultados";
}

function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session: { authenticated?: boolean; user?: { role?: Role } }) => {
        if (session.authenticated)
          window.location.replace(session.user?.role === "admin" ? "/usuarios" : safeRedirect());
      })
      .catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json()) as { message?: string; user?: { role?: Role } };
      if (!response.ok) {
        setMessage(payload.message ?? "Não foi possível entrar.");
        return;
      }
      if (mode === "register") {
        setRegistered(true);
        setMessage(payload.message ?? "Cadastro enviado para aprovação.");
      } else {
        window.location.replace(payload.user?.role === "admin" ? "/usuarios" : safeRedirect());
      }
    } catch {
      setMessage("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_82%_78%,hsl(var(--cyan)/0.14),transparent_30%)]" />

      <section className="relative hidden min-h-screen overflow-hidden border-r border-primary/10 bg-gradient-to-br from-primary/[0.14] via-background to-cyan/[0.08] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute -left-24 -top-24 size-[30rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/90 p-1.5 shadow-elevated ring-1 ring-primary/15">
            <img src="/vivo-mark.svg" alt="Vivo" className="size-full object-contain" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">Mapa Parque</p>
            <p className="text-xs text-muted-foreground">Inteligência de oportunidades</p>
          </div>
        </div>

        <div className="relative max-w-2xl pb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary backdrop-blur-xl">
            <ShieldCheck className="size-4" /> Ambiente protegido
          </span>
          <h1 className="mt-6 max-w-xl bg-gradient-brand bg-clip-text text-5xl font-semibold leading-[1.05] tracking-[-0.045em] text-transparent xl:text-6xl">
            Sua carteira, acessível somente para quem deve ver.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Entre para acessar os indicadores executivos, oportunidades comerciais e bases da
            operação.
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground">Vivo Empresas • Visão executiva</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/90 p-1.5 shadow-elevated ring-1 ring-primary/15">
              <img src="/vivo-mark.svg" alt="Vivo" className="size-full object-contain" />
            </span>
            <div>
              <p className="text-sm font-semibold">Mapa Parque</p>
              <p className="text-xs text-muted-foreground">Inteligência de oportunidades</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary/15 bg-card/85 p-6 shadow-elevated backdrop-blur-xl sm:p-8">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
              {mode === "login" ? (
                <LockKeyhole className="size-5" />
              ) : (
                <UserPlus className="size-5" />
              )}
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Acesse o painel" : "Solicite seu acesso"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "login"
                ? "Use suas credenciais para continuar."
                : "Seu cadastro será analisado pelo administrador."}
            </p>

            {registered ? (
              <div className="mt-7">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-5 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                  <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Solicitação enviada
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                    {message}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 h-11 w-full rounded-2xl"
                  onClick={() => {
                    setMode("login");
                    setRegistered(false);
                    setMessage("");
                    setPassword("");
                  }}
                >
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7 space-y-5">
                {mode === "register" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo</Label>
                      <Input
                        id="name"
                        name="name"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Seu nome"
                        className="h-12 rounded-2xl border-primary/15 bg-background/70 px-4"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nome@empresa.com.br"
                    className="h-12 rounded-2xl border-primary/15 bg-background/70 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Digite sua senha"
                      className="h-12 rounded-2xl border-primary/15 bg-background/70 px-4 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition hover:text-primary"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {message && (
                  <p
                    role="alert"
                    className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300"
                  >
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full gap-2 rounded-2xl text-sm font-semibold shadow-elevated"
                >
                  {submitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  {submitting
                    ? mode === "login"
                      ? "Validando acesso..."
                      : "Enviando cadastro..."
                    : mode === "login"
                      ? "Entrar no painel"
                      : "Solicitar cadastro"}
                </Button>
              </form>
            )}

            {!registered && (
              <button
                type="button"
                onClick={() => {
                  setMode((current) => (current === "login" ? "register" : "login"));
                  setMessage("");
                }}
                className="mt-5 w-full text-center text-sm font-medium text-primary transition hover:text-primary/80"
              >
                {mode === "login" ? "Ainda não tenho acesso" : "Já tenho um cadastro"}
              </button>
            )}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Sessão protegida e encerrada automaticamente após 8 horas.
          </p>
        </div>
      </section>
    </main>
  );
}
