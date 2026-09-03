import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "gn" | "director";

export type DataSnapshotKind =
  | "mapa-parque"
  | "resultados-yoy"
  | "best-guess"
  | "portabilidade-analitica"
  | "torres-servico"
  | "qsc";

export type DataSnapshotInfo = {
  kind: DataSnapshotKind;
  sourceName: string;
  updatedAt: string;
  sizeBytes: number;
  checksum: string;
};

export type DataImportInfo = {
  id: number;
  kind: string;
  sourceName: string;
  uploadedBy: string | null;
  status: "success" | "error";
  sizeBytes: number;
  message: string | null;
  createdAt: string;
};

export type StoredUser = {
  id: number;
  name: string;
  email: string;
  partnerName: string;
  passwordHash: string;
  status: UserStatus;
  role: UserRole;
  partnerIds: string[];
  createdAt: string;
  reviewedAt: string | null;
  lastLoginAt: string | null;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  partner_name: string;
  password_hash: string;
  status: UserStatus;
  role: UserRole;
  created_at: string;
  reviewed_at: string | null;
  last_login_at: string | null;
};

let database: DatabaseSync | undefined;

function databasePath() {
  const environment = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return resolve(environment?.DATABASE_PATH || "data/mapa-parque.sqlite");
}

function getDatabase() {
  if (database) return database;
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      partner_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      role TEXT NOT NULL DEFAULT 'gn',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      last_login_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_status_created_at ON users(status, created_at);
    CREATE TABLE IF NOT EXISTS user_partner_access (
      user_id INTEGER NOT NULL,
      partner_id TEXT NOT NULL,
      PRIMARY KEY (user_id, partner_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS data_snapshots (
      kind TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      source_name TEXT NOT NULL,
      uploaded_by TEXT,
      updated_at TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS data_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      source_name TEXT NOT NULL,
      uploaded_by TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'error')),
      size_bytes INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_data_imports_kind_created_at
      ON data_imports(kind, created_at DESC);
  `);
  const columns = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "role")) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'gn'");
  }
  return database;
}

function partnerIdsForUser(id: number) {
  return (
    getDatabase()
      .prepare("SELECT partner_id FROM user_partner_access WHERE user_id = ? ORDER BY partner_id")
      .all(id) as Array<{ partner_id: string }>
  ).map((row) => row.partner_id);
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    partnerName: row.partner_name,
    passwordHash: row.password_hash,
    status: row.status,
    role: row.role === "director" ? "director" : "gn",
    partnerIds: partnerIdsForUser(row.id),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    lastLoginAt: row.last_login_at,
  };
}

export function findUserByEmail(email: string): StoredUser | null {
  const row = getDatabase().prepare("SELECT * FROM users WHERE email = ? LIMIT 1").get(email) as
    UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createPendingUser(input: {
  name: string;
  email: string;
  partnerName: string;
  passwordHash: string;
}) {
  const createdAt = new Date().toISOString();
  const result = getDatabase()
    .prepare(
      `INSERT INTO users (name, email, partner_name, password_hash, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    )
    .run(input.name, input.email, input.partnerName, input.passwordHash, createdAt);
  return Number(result.lastInsertRowid);
}

export function listUsers(): StoredUser[] {
  const rows = getDatabase()
    .prepare(
      `SELECT * FROM users
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC`,
    )
    .all() as UserRow[];
  return rows.map(mapUser);
}

export function updateUserStatus(id: number, status: UserStatus) {
  const result = getDatabase()
    .prepare("UPDATE users SET status = ?, reviewed_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
  return result.changes > 0;
}

export function updateUserRole(id: number, role: UserRole) {
  const result = getDatabase().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  if (role === "director") {
    getDatabase().prepare("DELETE FROM user_partner_access WHERE user_id = ?").run(id);
  }
  return result.changes > 0;
}

export function setUserPartnerAccess(userId: number, partnerIds: string[]) {
  const db = getDatabase();
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    { role: UserRole } | undefined;
  if (!target || target.role !== "gn") return false;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM user_partner_access WHERE user_id = ?").run(userId);
    const insert = db.prepare(
      "INSERT INTO user_partner_access (user_id, partner_id) VALUES (?, ?)",
    );
    for (const partnerId of [...new Set(partnerIds)]) insert.run(userId, partnerId);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function registerUserLogin(id: number) {
  getDatabase()
    .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function saveDataSnapshot(input: {
  kind: DataSnapshotKind;
  payload: unknown;
  sourceName: string;
  uploadedBy?: string | null;
  sizeBytes?: number;
  recordImport?: boolean;
}) {
  const db = getDatabase();
  const payload = JSON.stringify(input.payload);
  const updatedAt = new Date().toISOString();
  const checksum = createHash("sha256").update(payload).digest("hex");
  const sizeBytes = input.sizeBytes ?? Buffer.byteLength(payload, "utf8");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO data_snapshots
        (kind, payload, source_name, uploaded_by, updated_at, size_bytes, checksum)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind) DO UPDATE SET
         payload = excluded.payload,
         source_name = excluded.source_name,
         uploaded_by = excluded.uploaded_by,
         updated_at = excluded.updated_at,
         size_bytes = excluded.size_bytes,
         checksum = excluded.checksum`,
    ).run(
      input.kind,
      payload,
      input.sourceName,
      input.uploadedBy ?? null,
      updatedAt,
      sizeBytes,
      checksum,
    );
    if (input.recordImport !== false) {
      db.prepare(
        `INSERT INTO data_imports
          (kind, source_name, uploaded_by, status, size_bytes, checksum, created_at)
         VALUES (?, ?, ?, 'success', ?, ?, ?)`,
      ).run(input.kind, input.sourceName, input.uploadedBy ?? null, sizeBytes, checksum, updatedAt);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { updatedAt, checksum, sizeBytes };
}

export function recordDataImportSuccess(input: {
  kind: string;
  sourceName: string;
  uploadedBy?: string | null;
  sizeBytes?: number;
  message?: string | null;
}) {
  getDatabase()
    .prepare(
      `INSERT INTO data_imports
        (kind, source_name, uploaded_by, status, size_bytes, message, created_at)
       VALUES (?, ?, ?, 'success', ?, ?, ?)`,
    )
    .run(
      input.kind,
      input.sourceName,
      input.uploadedBy ?? null,
      input.sizeBytes ?? 0,
      input.message ?? null,
      new Date().toISOString(),
    );
}

export function recordDataImportError(input: {
  kind: string;
  sourceName: string;
  uploadedBy?: string | null;
  sizeBytes?: number;
  message: string;
}) {
  getDatabase()
    .prepare(
      `INSERT INTO data_imports
        (kind, source_name, uploaded_by, status, size_bytes, message, created_at)
       VALUES (?, ?, ?, 'error', ?, ?, ?)`,
    )
    .run(
      input.kind,
      input.sourceName,
      input.uploadedBy ?? null,
      input.sizeBytes ?? 0,
      input.message,
      new Date().toISOString(),
    );
}

export function readDataSnapshot<T>(kind: DataSnapshotKind): T | null {
  const row = getDatabase()
    .prepare("SELECT payload FROM data_snapshots WHERE kind = ?")
    .get(kind) as { payload: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.payload) as T;
}

export function listDataSnapshots(): DataSnapshotInfo[] {
  const rows = getDatabase()
    .prepare(
      `SELECT kind, source_name, updated_at, size_bytes, checksum
       FROM data_snapshots ORDER BY kind`,
    )
    .all() as Array<{
    kind: DataSnapshotKind;
    source_name: string;
    updated_at: string;
    size_bytes: number;
    checksum: string;
  }>;
  return rows.map((row) => ({
    kind: row.kind,
    sourceName: row.source_name,
    updatedAt: row.updated_at,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
  }));
}

export function listDataImports(limit = 10, uploadedBy?: string): DataImportInfo[] {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const selection = `SELECT id, kind, source_name, uploaded_by, status, size_bytes, message, created_at
    FROM data_imports`;
  const rows = (
    uploadedBy
      ? getDatabase()
          .prepare(`${selection} WHERE uploaded_by = ? ORDER BY created_at DESC, id DESC LIMIT ?`)
          .all(uploadedBy, safeLimit)
      : getDatabase()
          .prepare(`${selection} ORDER BY created_at DESC, id DESC LIMIT ?`)
          .all(safeLimit)
  ) as Array<{
    id: number;
    kind: string;
    source_name: string;
    uploaded_by: string | null;
    status: "success" | "error";
    size_bytes: number;
    message: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    sourceName: row.source_name,
    uploadedBy: row.uploaded_by,
    status: row.status,
    sizeBytes: row.size_bytes,
    message: row.message,
    createdAt: row.created_at,
  }));
}
