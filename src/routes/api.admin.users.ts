import { createFileRoute } from "@tanstack/react-router";
import {
  isSameOriginRequest,
  requireAdmin,
  reviewUser,
  usersForAdministration,
} from "@/lib/auth.server";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async () => {
        if (!(await requireAdmin())) {
          return Response.json({ message: "Acesso restrito ao administrador." }, { status: 403 });
        }
        return Response.json(
          { users: usersForAdministration() },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      PATCH: async ({ request }) => {
        if (!(await requireAdmin())) {
          return Response.json({ message: "Acesso restrito ao administrador." }, { status: 403 });
        }
        if (!isSameOriginRequest(request)) {
          return Response.json(
            { message: "Origem da solicitação não permitida." },
            { status: 403 },
          );
        }
        const body = (await request.json()) as { id?: unknown; status?: unknown; role?: unknown };
        const id = Number(body.id);
        const status = body.status;
        const role = body.role;
        if (
          !Number.isInteger(id) ||
          id <= 0 ||
          (status !== "approved" && status !== "rejected") ||
          (role !== undefined && role !== "gn" && role !== "director")
        ) {
          return Response.json({ message: "Solicitação inválida." }, { status: 400 });
        }
        if (!reviewUser(id, status, role)) {
          return Response.json({ message: "Usuário não encontrado." }, { status: 404 });
        }
        return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
