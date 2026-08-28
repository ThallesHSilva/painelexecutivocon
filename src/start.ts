import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { AuthConfigurationError, publicRequestOrigin, readAuthUser } from "./lib/auth.server";

function publicUrl(path: string, request: Request) {
  return new URL(path, publicRequestOrigin(request));
}

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/session",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/vivo-mark.svg",
]);

const authMiddleware = createMiddleware().server(async ({ request, pathname, next }) => {
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/assets/")) return next();

  try {
    const user = await readAuthUser();
    if (user) {
      const adminOnly = pathname.startsWith("/api/admin/");
      const directorOnly = pathname.startsWith("/api/director/");
      const accessManagement = pathname === "/usuarios";
      if (adminOnly && user.role !== "admin") {
        return Response.json({ message: "Acesso restrito ao administrador." }, { status: 403 });
      }
      if (directorOnly && user.role !== "director") {
        return Response.json({ message: "Acesso restrito ao diretor." }, { status: 403 });
      }
      if (accessManagement && user.role !== "admin" && user.role !== "director") {
        return new Response(null, {
          status: 302,
          headers: {
            "Cache-Control": "no-store",
            Location: publicUrl("/resultados", request).toString(),
          },
        });
      }
      if (
        user.role === "admin" &&
        !adminOnly &&
        !accessManagement &&
        pathname !== "/api/auth/session" &&
        pathname !== "/api/auth/logout"
      ) {
        if (pathname.startsWith("/api/")) {
          return Response.json(
            { message: "O administrador gerencia somente os acessos." },
            { status: 403 },
          );
        }
        return new Response(null, {
          status: 302,
          headers: {
            "Cache-Control": "no-store",
            Location: publicUrl("/usuarios", request).toString(),
          },
        });
      }
      return next();
    }
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      const acceptsHtml = request.headers.get("accept")?.includes("text/html");
      return new Response(error.message, {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": acceptsHtml ? "text/plain; charset=utf-8" : "application/json",
        },
      });
    }
    throw error;
  }

  if (pathname.startsWith("/api/")) {
    return Response.json(
      { message: "Sua sessão expirou. Entre novamente." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = publicUrl("/login", request);
  loginUrl.searchParams.set("redirect", `${pathname}${new URL(request.url).search}`);
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: loginUrl.toString(),
    },
  });
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, authMiddleware],
}));
