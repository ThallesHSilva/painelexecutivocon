import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePartnerFilter } from "@/contexts/AppContexts";
import {
  invasaoTicketStorageKey,
  mergeInvasaoTicketEdits,
  sanitizeInvasaoTickets,
  type InvasaoModality,
  type InvasaoTickets,
  type InvasaoTicketEdits,
} from "@/lib/invasao-finance";

type TicketState = {
  tickets: InvasaoTickets;
  warning: string | null;
  pending?: InvasaoTicketEdits;
};

function withPending(fresh: TicketState, cached?: TicketState): TicketState {
  if (!cached?.pending || !Object.keys(cached.pending).length) return fresh;
  return {
    tickets: mergeInvasaoTicketEdits(fresh.tickets, cached.pending),
    pending: cached.pending,
    warning: cached.warning ?? fresh.warning,
  };
}

function readTickets(key: string): TicketState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return {
      tickets: stored?.version === 1 ? sanitizeInvasaoTickets(stored.tickets) : {},
      warning: null,
    };
  } catch {
    return {
      tickets: {},
      warning:
        "Não foi possível recuperar os tickets deste navegador. Confira os valores antes de gerar o relatório.",
    };
  }
}

/**
 * Tickets por mês e modalidade do histórico de altas, salvos neste navegador por
 * usuário. `active` é falso enquanto não há base de invasão para exibir.
 */
export function useInvasaoTickets(active: boolean) {
  const { role } = usePartnerFilter();
  const client = useQueryClient();
  const identity = useQuery({
    queryKey: ["invasao-ticket-identity"],
    enabled: active && (role === "director" || role === "gn"),
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/auth/session", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Não foi possível identificar o usuário dos tickets.");
      const body = (await response.json()) as { user?: { id: number; email: string } };
      if (!body.user) throw new Error("Sessão indisponível para os tickets.");
      return String(body.user.id ?? body.user.email);
    },
  });
  const key = active && identity.data ? invasaoTicketStorageKey(identity.data) : null;
  const queryKey = ["invasao-tickets", key] as const;
  const stored = useQuery({
    queryKey,
    enabled: !!key,
    staleTime: 0,
    refetchOnMount: "always",
    // Live updates arrive through storage events; focus must not reset an active edit/print.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => withPending(readTickets(key!), client.getQueryData<TicketState>(queryKey)),
  });
  useEffect(() => {
    if (!key) return;
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) {
        const queryKey = ["invasao-tickets", key];
        client.setQueryData(
          queryKey,
          withPending(readTickets(key), client.getQueryData<TicketState>(queryKey)),
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [client, key]);

  const setTicket = (month: string, modality: InvasaoModality, cents: number | null) => {
    if (!key) return;
    const cached = client.getQueryData<TicketState>(queryKey);
    const pending: InvasaoTicketEdits = {
      ...cached?.pending,
      [month]: { ...cached?.pending?.[month], [modality]: cents },
    };
    const tickets = mergeInvasaoTicketEdits(readTickets(key).tickets, pending);
    let warning: string | null = null;
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, tickets }));
    } catch {
      warning =
        "Tickets não salvos no navegador. Os valores estão apenas nesta sessão; outra aba não poderá recuperá-los.";
    }
    client.setQueryData<TicketState>(queryKey, {
      tickets,
      warning,
      pending: warning ? pending : undefined,
    });
  };
  return {
    tickets: stored.data?.tickets ?? {},
    setTicket,
    storageKey: key,
    isReady: !active || identity.isError || (!!key && !stored.isPending && !stored.isFetching),
    warning: identity.error?.message ?? stored.data?.warning ?? null,
  };
}
