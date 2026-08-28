import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Clock3,
  Database,
  LoaderCircle,
  Save,
  ShieldCheck,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardLayout } from "@/layouts/DashboardLayout";

type Role = "admin" | "director" | "gn";
type ManagedUser = {
  id: number;
  name: string;
  email: string;
  partnerName: string;
  role: "director" | "gn";
  partnerIds: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  lastLoginAt: string | null;
};
type BaseUpdate = { available: boolean; updatedAt: string | null };
type Partner = {
  id: string;
  name: string;
  updates: {
    mapaParque: BaseUpdate;
    qscCarteira: BaseUpdate;
    qscFixa: BaseUpdate;
    qscMovel: BaseUpdate;
    resultadosYoy: BaseUpdate;
    bestGuess: BaseUpdate;
    portabilidade: BaseUpdate;
  };
};

const statusInfo = {
  pending: { label: "Pendente", className: "border-amber-500/20 bg-amber-500/10 text-amber-700" },
  approved: {
    label: "Ativo",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  },
  rejected: { label: "Cancelado", className: "border-rose-500/20 bg-rose-500/10 text-rose-700" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function BaseUpdateStatus({ update }: { update: BaseUpdate }) {
  if (!update.available) {
    return <span className="text-[11px] font-medium text-muted-foreground/55">Sem base</span>;
  }
  if (!update.updatedAt) {
    return (
      <span className="inline-flex rounded-lg border border-amber-500/15 bg-amber-500/[0.07] px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
        Data não registrada
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-2 py-1 text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
      {formatDate(update.updatedAt)}
    </span>
  );
}

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Acessos — Mapa Parque" }] }),
  component: UsersPage,
});

function UsersPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, "director" | "gn">>({});
  const [draftAccess, setDraftAccess] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (knownRole?: Role) => {
    setLoading(true);
    setMessage("");
    try {
      let activeRole = knownRole;
      if (!activeRole) {
        const session = (await fetch("/api/auth/session", { cache: "no-store" }).then((response) =>
          response.json(),
        )) as { user?: { role?: Role } };
        activeRole = session.user?.role;
        setRole(activeRole ?? null);
      }
      const endpoint = activeRole === "admin" ? "/api/admin/users" : "/api/director/access";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = (await response.json()) as {
        users?: ManagedUser[];
        partners?: Partner[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível carregar os acessos.");
      const loadedUsers = payload.users ?? [];
      setUsers(loadedUsers);
      setPartners(payload.partners ?? []);
      setDraftRoles(Object.fromEntries(loadedUsers.map((user) => [user.id, user.role])));
      setDraftAccess(Object.fromEntries(loadedUsers.map((user) => [user.id, user.partnerIds])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os acessos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => user.status === "pending").length,
      approved: users.filter((user) => user.status === "approved").length,
    }),
    [users],
  );

  const review = async (user: ManagedUser, status: "approved" | "rejected") => {
    setUpdatingId(user.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status, role: draftRoles[user.id] ?? user.role }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(payload.message ?? "Não foi possível atualizar o cadastro.");
      await loadData("admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o cadastro.");
    } finally {
      setUpdatingId(null);
    }
  };

  const saveAccess = async (userId: number) => {
    setUpdatingId(userId);
    setMessage("");
    try {
      const response = await fetch("/api/director/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, partnerIds: draftAccess[userId] ?? [] }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível salvar a carteira.");
      await loadData("director");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a carteira.");
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePartner = (userId: number, partnerId: string) => {
    setDraftAccess((current) => {
      const selected = current[userId] ?? [];
      return {
        ...current,
        [userId]: selected.includes(partnerId)
          ? selected.filter((id) => id !== partnerId)
          : [...selected, partnerId],
      };
    });
  };

  const admin = role === "admin";
  return (
    <DashboardLayout title="Acessos">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/[0.14] via-card to-cyan/[0.08] p-6 shadow-elevated sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                <ShieldCheck className="size-4" /> {admin ? "Administração" : "Gestão de carteira"}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                {admin ? "Autorizações de usuários" : "Parceiros por GN"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {admin
                  ? "Aprove cadastros, defina o perfil e cancele acessos quando necessário."
                  : "Defina quais parceiros cada GN poderá consultar no painel."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadData(role ?? undefined)}
              className="rounded-2xl"
            >
              Atualizar lista
            </Button>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: admin ? "Cadastros" : "GNs", value: totals.total, icon: UsersRound },
            {
              label: admin ? "Aguardando" : "Parceiros disponíveis",
              value: admin ? totals.pending : partners.length,
              icon: Clock3,
            },
            {
              label: admin ? "Ativos" : "GNs com acesso",
              value: admin
                ? totals.approved
                : users.filter((user) => user.partnerIds.length).length,
              icon: UserCheck,
            },
          ].map((item) => (
            <Card
              key={item.label}
              className="rounded-[1.6rem] border-primary/10 bg-card/85 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{item.value}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/[0.07] text-primary">
                  <item.icon className="size-5" />
                </span>
              </div>
            </Card>
          ))}
        </div>

        {!admin && (
          <Card className="overflow-hidden rounded-[2rem] border-primary/15 bg-card/90 shadow-elevated">
            <div className="flex flex-col gap-3 border-b border-primary/10 bg-gradient-to-r from-primary/[0.055] to-cyan/[0.035] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/[0.1] text-primary ring-4 ring-background/50">
                  <Database className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Bases e acessos por parceiro
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Visão consolidada das cargas disponíveis e dos GNs vinculados.
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="w-fit rounded-xl border-primary/15 bg-background/70 px-3 py-1.5 text-primary"
              >
                {partners.length} parceiro(s)
              </Badge>
            </div>
            <div className="overflow-x-auto p-3 sm:p-5">
              <div className="overflow-hidden rounded-2xl border border-primary/10 bg-background/70">
                <Table className="min-w-[1480px]">
                  <TableHeader className="bg-primary/[0.04] [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-primary/10 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[220px]">Parceiro</TableHead>
                      <TableHead className="w-[170px]">Mapa Parque</TableHead>
                      <TableHead className="w-[230px]">QSC</TableHead>
                      <TableHead className="w-[170px]">Resultados YoY</TableHead>
                      <TableHead className="w-[170px]">Best Guess</TableHead>
                      <TableHead className="w-[170px]">Portabilidade</TableHead>
                      <TableHead className="min-w-[260px]">GNs vinculados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:border-primary/[0.07] [&_td]:px-4 [&_td]:py-4 [&_tr]:transition-colors [&_tr:hover]:bg-primary/[0.025]">
                    {partners.map((partner) => {
                      const assignedUsers = users.filter((user) =>
                        (draftAccess[user.id] ?? []).includes(partner.id),
                      );
                      return (
                        <TableRow key={partner.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-xs font-bold text-primary">
                                {partner.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {partner.name}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {partner.id}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <BaseUpdateStatus update={partner.updates.mapaParque} />
                          </TableCell>
                          <TableCell>
                            <div className="grid gap-1.5">
                              {[
                                ["Carteira", partner.updates.qscCarteira],
                                ["Fixa", partner.updates.qscFixa],
                                ["Móvel", partner.updates.qscMovel],
                              ].map(([label, update]) => (
                                <div
                                  key={label as string}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="text-[10px] font-semibold text-muted-foreground">
                                    {label as string}
                                  </span>
                                  <BaseUpdateStatus update={update as BaseUpdate} />
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <BaseUpdateStatus update={partner.updates.resultadosYoy} />
                          </TableCell>
                          <TableCell>
                            <BaseUpdateStatus update={partner.updates.bestGuess} />
                          </TableCell>
                          <TableCell>
                            <BaseUpdateStatus update={partner.updates.portabilidade} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {assignedUsers.length ? (
                                assignedUsers.map((user) => (
                                  <Badge
                                    key={user.id}
                                    variant="outline"
                                    className="rounded-lg border-primary/15 bg-primary/[0.055] text-[10px] font-semibold text-primary"
                                  >
                                    {user.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Nenhum GN vinculado
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden rounded-[2rem] border-primary/15 bg-card/90 shadow-elevated">
          <div className="border-b border-primary/10 px-5 py-5 sm:px-7">
            <h2 className="text-lg font-semibold tracking-tight">
              {admin ? "Solicitações de acesso" : "Escopo de visualização"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {admin
                ? "O cancelamento encerra o acesso imediatamente."
                : "Um GN pode receber um ou vários parceiros."}
            </p>
          </div>
          {message && (
            <p className="mx-5 mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {message}
            </p>
          )}
          {loading ? (
            <div className="grid min-h-56 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
              Nenhum usuário disponível.
            </div>
          ) : admin ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Empresa informada</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const busy = updatingId === user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </TableCell>
                        <TableCell>{user.partnerName || "A definir pelo diretor"}</TableCell>
                        <TableCell>
                          <select
                            value={draftRoles[user.id] ?? user.role}
                            onChange={(event) =>
                              setDraftRoles((current) => ({
                                ...current,
                                [user.id]: event.target.value as "gn" | "director",
                              }))
                            }
                            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                          >
                            <option value="gn">GN</option>
                            <option value="director">Diretor</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo[user.status].className}>
                            {statusInfo[user.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(user.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || user.status === "rejected"}
                              onClick={() => void review(user, "rejected")}
                              className="rounded-xl text-rose-600"
                            >
                              <X className="size-4" /> Cancelar
                            </Button>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void review(user, "approved")}
                              className="rounded-xl"
                            >
                              {busy ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                <Check className="size-4" />
                              )}{" "}
                              {user.status === "approved" ? "Salvar perfil" : "Aprovar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:p-7">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-2xl border border-primary/10 bg-primary/[0.025] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="outline">
                      {(draftAccess[user.id] ?? []).length} parceiro(s)
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {partners.map((partner) => (
                      <label
                        key={partner.id}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-primary/10 bg-background/70 px-3 py-2.5 text-sm"
                      >
                        <Checkbox
                          checked={(draftAccess[user.id] ?? []).includes(partner.id)}
                          onCheckedChange={() => togglePartner(user.id, partner.id)}
                        />
                        <span className="truncate">{partner.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => void saveAccess(user.id)}
                      disabled={updatingId === user.id}
                      className="rounded-xl"
                    >
                      {updatingId === user.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}{" "}
                      Salvar carteira
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
