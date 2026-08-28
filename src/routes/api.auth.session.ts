import { createFileRoute } from "@tanstack/react-router";
import { readAuthUser } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async () => {
        const user = await readAuthUser();
        return Response.json(
          { authenticated: Boolean(user), user },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
