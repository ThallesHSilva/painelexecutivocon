import { createFileRoute } from "@tanstack/react-router";
import { isSameOriginRequest, register } from "@/lib/auth.server";

function validPassword(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

export const Route = createFileRoute("/api/auth/register")({
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
          const body = (await request.json()) as Record<string, unknown>;
          const name = typeof body.name === "string" ? body.name.trim() : "";
          const email = typeof body.email === "string" ? body.email.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";

          if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) {
            return Response.json(
              { message: "Preencha corretamente seu nome e e-mail." },
              { status: 400 },
            );
          }
          if (!validPassword(password)) {
            return Response.json(
              { message: "A senha precisa ter 8 caracteres, maiúscula, minúscula e número." },
              { status: 400 },
            );
          }

          const result = await register({ name, email, partnerName: "", password });
          if (!result.ok) {
            return Response.json(
              { message: "Já existe um cadastro para este e-mail." },
              { status: 409 },
            );
          }
          return Response.json(
            {
              registered: true,
              message: "Cadastro enviado. Aguarde a aprovação do administrador para entrar.",
            },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { message: "Não foi possível concluir o cadastro." },
            { status: 400 },
          );
        }
      },
    },
  },
});
