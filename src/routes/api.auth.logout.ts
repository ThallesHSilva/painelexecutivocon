import { createFileRoute } from "@tanstack/react-router";
import { destroyAuthSession, isSameOriginRequest } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOriginRequest(request)) {
          return Response.json(
            { message: "Origem da solicitação não permitida." },
            { status: 403 },
          );
        }
        await destroyAuthSession();
        return Response.json(
          { authenticated: false },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
