import { NextResponse } from "next/server";
import { getDb, addLog } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RuleRow {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  scope: string;
  status: string;
  triggered_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

function mapRule(r: RuleRow) {
  return {
    id: r.id,
    name: r.name,
    metric: r.metric,
    operator: r.operator,
    threshold: Number(r.threshold),
    action: r.action,
    scope: r.scope,
    status: r.status,
    triggeredCount: Number(r.triggered_count),
    lastTriggeredAt: r.last_triggered_at,
    createdAt: r.created_at,
  };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM rules ORDER BY created_at DESC")
    .all() as unknown as RuleRow[];
  return NextResponse.json({ data: rows.map(mapRule) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    metric?: string;
    operator?: string;
    threshold?: number;
    action?: string;
    scope?: string;
  };

  if (!body.name?.trim() || !body.metric || !body.action) {
    return NextResponse.json({ error: "规则名称、监控指标和动作不能为空" }, { status: 400 });
  }
  const threshold = Number(body.threshold ?? 0);
  if (!Number.isFinite(threshold)) {
    return NextResponse.json({ error: "阈值必须为数字" }, { status: 400 });
  }

  const db = getDb();
  const id = `rule_${Date.now().toString(36)}`;
  db.prepare(
    `INSERT INTO rules (id, name, metric, operator, threshold, action, scope, status, triggered_count, last_triggered_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name.trim(),
    body.metric,
    body.operator || ">",
    threshold,
    body.action,
    body.scope || "全部账户",
    "启用",
    0,
    null,
    new Date().toISOString()
  );

  addLog(
    db,
    "规则创建",
    `规则「${body.name.trim()}」`,
    `监控指标：${body.metric} ${body.operator || ">"} ${threshold}，动作：${body.action}`
  );

  const row = db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as unknown as RuleRow;
  return NextResponse.json({ data: mapRule(row) });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string; status?: string; run?: boolean };
  if (!body.id) {
    return NextResponse.json({ error: "缺少规则 ID" }, { status: 400 });
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM rules WHERE id = ?").get(body.id) as
    | unknown as RuleRow
    | undefined;
  if (!row) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  if (body.status) {
    db.prepare("UPDATE rules SET status = ? WHERE id = ?").run(body.status, body.id);
    addLog(db, "规则状态", `规则「${row.name}」`, `状态变更为${body.status}`);
  }

  if (body.run) {
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE rules SET triggered_count = triggered_count + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, body.id);
    addLog(db, "规则触发", `规则「${row.name}」`, `手动执行一次，动作：${row.action}`);
  }

  const updated = db.prepare("SELECT * FROM rules WHERE id = ?").get(body.id) as unknown as RuleRow;
  return NextResponse.json({ data: mapRule(updated) });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "缺少规则 ID" }, { status: 400 });
  }
  const db = getDb();
  const row = db.prepare("SELECT name FROM rules WHERE id = ?").get(body.id) as
    | { name: string }
    | undefined;
  if (!row) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }
  db.prepare("DELETE FROM rules WHERE id = ?").run(body.id);
  addLog(db, "规则删除", `规则「${row.name}」`, "规则已删除");
  return NextResponse.json({ data: { ok: true } });
}
