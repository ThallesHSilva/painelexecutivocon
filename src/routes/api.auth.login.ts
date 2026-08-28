import { createFileRoute } from "@tanstack/react-router";
import { AuthConfigurationError, isSameOriginRequest, login } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOriginRequest(request)) {
          return Response.json(
            { message: "Origem da solicitação não permitida." },
            { status: 403 },
          );
        }

        try {
          const payload = (await request.json()) as { email?: unknown; password?: unknown };
          const email = typeof payload.email === "string" ? payload.email : "";
          const password = typeof payload.password === "string" ? payload.password : "";
          if (!email || !password) {
            return Response.json({ message: "E-mail ou senha incorretos." }, { status: 401 });
          }

          const result = await login(email, password);
          if (!result.ok) {
            const messages = {
              invalid: "E-mail ou senha incorretos.",
              pending: "Seu cadastro ainda está aguardando aprovação do administrador.",
              rejected: "Este cadastro não foi autorizado. Fale com o administrador.",
            };
            return Response.json(
              { message: messages[result.reason], reason: result.reason },
              { status: 403, headers: { "Cache-Control": "no-store" } },
            );
          }

          return Response.json(
            { authenticated: true, user: result.user },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if (error instanceof AuthConfigurationError) {
            return Response.json({ message: error.message }, { status: 503 });
          }
          return Response.json({ message: "Não foi possível iniciar a sessão." }, { status: 400 });
        }
      },
    },
  },
});
