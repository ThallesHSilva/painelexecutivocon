import { clearSession, getSession, updateSession } from "@tanstack/react-start/server";
import {
  createPendingUser,
  findUserByEmail,
  listUsers,
  registerUserLogin,
  setUserPartnerAccess,
  updateUserRole,
  updateUserStatus,
  type UserRole,
  type UserStatus,
} from "@/lib/database.server";

export type AuthUser = {
  id: number | null;
  email: string;
  name: string;
  role: "admin" | UserRole;
  partnerName: string | null;
  partnerIds: string[];
};

type AuthSessionData = {
  authenticated: boolean;
  user: AuthUser;
  expiresAt: number;
};

export type LoginResult =
  { ok: true; user: AuthUser } | { ok: false; reason: "invalid" | "pending" | "rejected" };

const SESSION_NAME = "mapa-parque-session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const HASH_ITERATIONS = 210_000;
const DEVELOPMENT_EMAIL = "admin@mapaparque.local";
const DEVELOPMENT_PASSWORD = "admin123";
const DEVELOPMENT_SECRET = "mapa-parque-development-secret-change-me-2026";
const CLOUDFLARE_PUBLIC_ORIGIN = "https://mapaparque.consultaa7.com.br";

export class AuthConfigurationError extends Error {
  constructor() {
    super(
      "A autenticação não foi configurada. Defina AUTH_EMAIL, AUTH_PASSWORD_HASH e AUTH_SECRET no servidor.",
    );
    this.name = "AuthConfigurationError";
  }
}

function runtimeEnvironment() {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
}

function isProduction() {
  return runtimeEnvironment()?.NODE_ENV === "production";
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function forwardedProtocol(request: Request) {
  const forwarded = firstForwardedValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  if (forwarded === "http" || forwarded === "https") return `${forwarded}:`;

  const visitor = request.headers.get("cf-visitor");
  if (visitor) {
    try {
      const scheme = (JSON.parse(visitor) as { scheme?: unknown }).scheme;
      if (scheme === "http" || scheme === "https") return `${scheme}:`;
    } catch {
      // Ignore malformed proxy metadata and fall back to the request URL.
    }
  }
  return new URL(request.url).protocol;
}

export function publicRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = runtimeEnvironment()?.APP_ORIGIN?.trim();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Invalid optional configuration must not break authentication.
    }
  }

  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ??
    request.headers.get("host") ??
    requestUrl.host;
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    localHosts.has(host.split(":")[0]) &&
    (request.headers.has("cf-ray") || request.headers.has("cf-visitor"))
  ) {
    return CLOUDFLARE_PUBLIC_ORIGIN;
  }
  try {
    return new URL(`${forwardedProtocol(request)}//${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestUrl = new URL(request.url);
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const allowedOrigins = new Set([requestUrl.origin, publicRequestOrigin(request)]);
  for (const configured of runtimeEnvironment()?.AUTH_ALLOWED_ORIGINS?.split(",") ?? []) {
    try {
      allowedOrigins.add(new URL(configured.trim()).origin);
    } catch {
      // Ignore invalid entries instead of weakening the origin validation.
    }
  }
  if (allowedOrigins.has(normalizedOrigin)) return true;
  if (isProduction()) return false;
  try {
    const originUrl = new URL(normalizedOrigin);
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      localHosts.has(originUrl.hostname) &&
      localHosts.has(requestUrl.hostname) &&
      originUrl.protocol === requestUrl.protocol &&
      originUrl.port === requestUrl.port
    );
  } catch {
    return false;
  }
}

function sessionSecret() {
  const secret = runtimeEnvironment()?.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction()) throw new AuthConfigurationError();
  return DEVELOPMENT_SECRET;
}

function sessionConfig() {
  return {
    password: sessionSecret(),
    name: SESSION_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    sessionHeader: false as const,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: isProduction(),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[a-f\d]+$/i.test(value) || value.length % 2 !== 0) return null;
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= left[index % left.length] ^ right[index % right.length];
  }
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt, HASH_ITERATIONS);
  return `pbkdf2-sha256$${HASH_ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, hashValue] = storedHash.split("$");
  const iterations = Number(iterationsValue);
  const salt = fromHex(saltValue ?? "");
  const expected = fromHex(hashValue ?? "");
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !salt ||
    !expected
  ) {
    return false;
  }
  return constantTimeEqual(await derivePassword(password, salt, iterations), expected);
}

async function adminCredentials() {
  const environment = runtimeEnvironment();
  const email = environment?.AUTH_EMAIL?.trim().toLocaleLowerCase("pt-BR");
  const passwordHash = environment?.AUTH_PASSWORD_HASH;
  if (email && passwordHash) return { email, passwordHash };
  if (isProduction()) throw new AuthConfigurationError();
  return { email: DEVELOPMENT_EMAIL, passwordHash: await hashPassword(DEVELOPMENT_PASSWORD) };
}

async function writeSession(user: AuthUser) {
  await updateSession<AuthSessionData>(sessionConfig(), {
    authenticated: true,
    user,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLocaleLowerCase("pt-BR");
  const admin = await adminCredentials();

  if (normalizedEmail === admin.email) {
    if (!(await verifyPassword(password, admin.passwordHash)))
      return { ok: false, reason: "invalid" };
    const user: AuthUser = {
      id: null,
      email: admin.email,
      name: "Administrador",
      role: "admin",
      partnerName: null,
      partnerIds: [],
    };
    await writeSession(user);
    return { ok: true, user };
  }

  const storedUser = findUserByEmail(normalizedEmail);
  if (!storedUser || !(await verifyPassword(password, storedUser.passwordHash))) {
    return { ok: false, reason: "invalid" };
  }
  if (storedUser.status !== "approved") return { ok: false, reason: storedUser.status };

  const user: AuthUser = {
    id: storedUser.id,
    email: storedUser.email,
    name: storedUser.name,
    role: storedUser.role,
    partnerName: storedUser.partnerName,
    partnerIds: storedUser.role === "gn" ? storedUser.partnerIds : [],
  };
  registerUserLogin(storedUser.id);
  await writeSession(user);
  return { ok: true, user };
}

export async function register(input: {
  name: string;
  email: string;
  partnerName: string;
  password: string;
}) {
  const email = input.email.trim().toLocaleLowerCase("pt-BR");
  if (findUserByEmail(email)) return { ok: false as const, reason: "exists" as const };
  createPendingUser({
    name: input.name.trim(),
    email,
    partnerName: input.partnerName.trim(),
    passwordHash: await hashPassword(input.password),
  });
  return { ok: true as const };
}

export async function readAuthUser(): Promise<AuthUser | null> {
  const session = await getSession<AuthSessionData>(sessionConfig());
  if (
    session.data.authenticated !== true ||
    !session.data.user ||
    !session.data.expiresAt ||
    session.data.expiresAt <= Date.now()
  ) {
    return null;
  }
  const sessionUser = session.data.user;
  if (sessionUser.role === "admin") return sessionUser;
  if (!sessionUser.id) return null;
  const storedUser = findUserByEmail(sessionUser.email);
  if (!storedUser || storedUser.status !== "approved" || storedUser.id !== sessionUser.id) {
    await clearSession({ name: SESSION_NAME });
    return null;
  }
  return {
    id: storedUser.id,
    email: storedUser.email,
    name: storedUser.name,
    role: storedUser.role,
    partnerName: storedUser.partnerName,
    partnerIds: storedUser.role === "gn" ? storedUser.partnerIds : [],
  };
}

export async function requireAdmin() {
  const user = await readAuthUser();
  return user?.role === "admin" ? user : null;
}

export async function requireDirector() {
  const user = await readAuthUser();
  return user?.role === "director" ? user : null;
}

export function usersForAdministration() {
  return listUsers().map(({ passwordHash: _passwordHash, ...user }) => user);
}

export function reviewUser(
  id: number,
  status: Extract<UserStatus, "approved" | "rejected">,
  role?: UserRole,
) {
  if (role && !updateUserRole(id, role)) return false;
  return updateUserStatus(id, status);
}

export function assignPartnersToGn(id: number, partnerIds: string[]) {
  return setUserPartnerAccess(id, partnerIds);
}

export async function destroyAuthSession() {
  await clearSession({ name: SESSION_NAME });
}
