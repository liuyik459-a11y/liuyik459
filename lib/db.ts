import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedDatabase } from "./seed";

declare global {
  // eslint-disable-next-line no-var
  var __feedAdsDb: DatabaseSync | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  baidu_user_id TEXT NOT NULL,
  industry TEXT NOT NULL,
  status TEXT NOT NULL,
  balance REAL NOT NULL,
  daily_budget REAL NOT NULL,
  auth_status TEXT NOT NULL,
  operator TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  budget REAL NOT NULL,
  bid REAL NOT NULL,
  targeting TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  account_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  impressions INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  cost REAL NOT NULL,
  conversions INTEGER NOT NULL,
  revenue REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stats_date ON stats(date);
CREATE INDEX IF NOT EXISTS idx_stats_account ON stats(account_id);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT NOT NULL,
  tag TEXT NOT NULL,
  color_a TEXT NOT NULL,
  color_b TEXT NOT NULL,
  status TEXT NOT NULL,
  ctr REAL NOT NULL,
  used_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creatives (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_ids TEXT NOT NULL,
  plan_count INTEGER NOT NULL,
  unit_count INTEGER NOT NULL,
  creative_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold REAL NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  triggered_count INTEGER NOT NULL,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function getDb(): DatabaseSync {
  if (globalThis.__feedAdsDb) return globalThis.__feedAdsDb;

  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(path.join(dir, "app.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  ensureColumn(db, "plans", "baidu_id", "TEXT");
  ensureColumn(db, "plans", "baidu_adgroup_id", "TEXT");

  const row = db.prepare("SELECT COUNT(*) AS c FROM accounts").get() as { c: number };
  if (!row || Number(row.c) === 0) {
    seedDatabase(db);
  }

  globalThis.__feedAdsDb = db;
  return db;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function addLog(
  db: DatabaseSync,
  action: string,
  target: string,
  detail: string,
  operator = "运营小张"
): void {
  db.prepare(
    "INSERT INTO logs (id, action, target, detail, operator, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    `log_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    action,
    target,
    detail,
    operator,
    new Date().toISOString()
  );
}
