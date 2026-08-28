import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const sourceDirectory = path.resolve(process.argv[2] ?? "src/data");
const databasePath = path.resolve(process.env.DATABASE_PATH ?? "data/mapa-parque.sqlite");
const definitions = [
  ["mapa-parque", "mapa-parque.snapshot.json"],
  ["resultados-yoy", "resultados-yoy.snapshot.json"],
  ["best-guess", "best-guess.snapshot.json"],
  ["portabilidade-analitica", "analitico-portabilidade.snapshot.json"],
  ["torres-servico", "torres-servico.snapshot.json"],
  ["qsc", "qsc.snapshot.json"],
];

mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
database.exec(`
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
`);

const upsert = database.prepare(`
  INSERT INTO data_snapshots
    (kind, payload, source_name, uploaded_by, updated_at, size_bytes, checksum)
  VALUES (?, ?, ?, 'migration', ?, ?, ?)
  ON CONFLICT(kind) DO UPDATE SET
    payload = excluded.payload,
    source_name = excluded.source_name,
    uploaded_by = excluded.uploaded_by,
    updated_at = excluded.updated_at,
    size_bytes = excluded.size_bytes,
    checksum = excluded.checksum
`);

const migrated = [];
database.exec("BEGIN IMMEDIATE");
try {
  for (const [kind, fileName] of definitions) {
    const filePath = path.join(sourceDirectory, fileName);
    const payload = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(payload);
    const source = Array.isArray(parsed.source) ? parsed.source[0] : parsed.source;
    const updatedAt =
      source?.importedAt ?? source?.sourceModifiedAt ?? (await fs.stat(filePath)).mtime.toISOString();
    const checksum = createHash("sha256").update(payload).digest("hex");
    upsert.run(kind, payload, fileName, updatedAt, Buffer.byteLength(payload), checksum);
    migrated.push({ kind, fileName, checksum, bytes: Buffer.byteLength(payload) });
  }
  database.exec("COMMIT");
  database.exec("PRAGMA wal_checkpoint(TRUNCATE);");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
} finally {
  database.close();
}

console.log(JSON.stringify({ databasePath, migrated }, null, 2));
