import { NextResponse } from "next/server";
import { getDb, addLog } from "@/lib/db";
import { getBaiduAdapter } from "@/lib/baidu";
import type { BatchTask } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  name: string;
  account_ids: string;
  plan_count: number;
  unit_count: number;
  creative_count: number;
  status: string;
  progress: number;
  created_by: string;
  created_at: string;
}

interface BatchPayload {
  name?: string;
  accountIds?: string[];
  plansPerAccount?: number;
  planNamePattern?: string;
  budget?: number;
  bid?: number;
  targeting?: string;
  materialIds?: string[];
  creativeTitles?: string[];
  operator?: string;
}

export async function GET() {
  const db = getDb();
  const tasks = db
    .prepare("SELECT * FROM batch_tasks ORDER BY created_at DESC")
    .all() as unknown as TaskRow[];

  const accounts = db.prepare("SELECT id, name FROM accounts").all() as unknown as Array<{
    id: string;
    name: string;
  }>;
  const nameMap = new Map(accounts.map((a) => [a.id, a.name]));

  const data = tasks.map((t) => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(t.account_ids) as string[];
    } catch {
      ids = [];
    }
    return {
      id: t.id,
      name: t.name,
      accountIds: ids,
      accountNames: ids.map((id) => nameMap.get(id) ?? id),
      planCount: t.plan_count,
      unitCount: t.unit_count,
      creativeCount: t.creative_count,
      status: t.status,
      progress: t.progress,
      createdBy: t.created_by,
      createdAt: t.created_at,
    };
  });

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as BatchPayload;
  const accountIds = body.accountIds ?? [];
  const plansPerAccount = Math.max(1, Math.min(10, Number(body.plansPerAccount ?? 3)));
  const budget = Number(body.budget ?? 800);
  const bid = Number(body.bid ?? 0.8);
  const operator = body.operator || "运营小张";

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "请填写任务名称" }, { status: 400 });
  }
  if (accountIds.length === 0) {
    return NextResponse.json({ error: "请至少选择一个投放账户" }, { status: 400 });
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return NextResponse.json({ error: "日预算必须大于 0" }, { status: 400 });
  }

  const db = getDb();
  const accounts = db
    .prepare(
      `SELECT id, name FROM accounts WHERE id IN (${accountIds.map(() => "?").join(",")})`
    )
    .all(...accountIds) as unknown as Array<{ id: string; name: string }>;
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const materials = db.prepare("SELECT id FROM materials WHERE status = '可用'").all() as unknown as Array<{
    id: string;
  }>;
  const selectedMaterials = (body.materialIds ?? []).length
    ? body.materialIds ?? []
    : materials.slice(0, 2).map((m) => m.id);
  const titles = (body.creativeTitles ?? []).filter((t) => t.trim()).slice(0, 3);
  const fallbackTitles = ["限时优惠进行中，点击查看详情", "爆款好物，下单立减", "同款热卖，库存有限"];
  const creativeTitles = titles.length ? titles : fallbackTitles;

  const adapter = getBaiduAdapter();
  const pattern = body.planNamePattern?.trim() || "{账户}-{日期}-{序号}-信息流";
  const todayTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const targeting = body.targeting || "全国 · 18-45岁 · 移动端 · 全时段";

  let planCount = 0;
  let creativeCount = 0;
  const failures: string[] = [];

  for (const accountId of accountIds) {
    const accountName = accountMap.get(accountId) ?? accountId;
    for (let i = 1; i <= plansPerAccount; i++) {
      const planName = pattern
        .replace("{账户}", accountName)
        .replace("{日期}", todayTag)
        .replace("{序号}", `${i}`.padStart(2, "0"));

      const result = await adapter.createPlan({
        accountId,
        name: planName,
        budget,
        bid,
        targeting,
        operator,
      });
      if (!result.ok) {
        failures.push(`${accountName} / ${planName}`);
        continue;
      }
      planCount += 1;

      const creativeNum = Math.min(2, Math.max(1, selectedMaterials.length));
      for (let c = 0; c < creativeNum; c++) {
        const created = await adapter.createCreative({
          planId: result.planId,
          materialId: selectedMaterials[c % selectedMaterials.length],
          title: creativeTitles[c % creativeTitles.length],
          description: "点击查看详情，限时优惠进行中",
        });
        if (created.ok) creativeCount += 1;
      }
    }
  }

  const taskId = `task_${Date.now().toString(36)}`;
  const status = failures.length ? "部分失败" : "已完成";
  db.prepare(
    `INSERT INTO batch_tasks (id, name, account_ids, plan_count, unit_count, creative_count, status, progress, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    taskId,
    body.name.trim(),
    JSON.stringify(accountIds),
    planCount,
    planCount,
    creativeCount,
    status,
    failures.length ? 60 : 100,
    operator,
    new Date().toISOString()
  );

  addLog(
    db,
    "批量创建",
    `投放任务「${body.name.trim()}」`,
    `覆盖 ${accountIds.length} 个账户，创建 ${planCount} 条计划、${creativeCount} 条创意${
      failures.length ? `，${failures.length} 条失败` : ""
    }`,
    operator
  );

  const task: BatchTask & { accountNames: string[]; failures: string[] } = {
    id: taskId,
    name: body.name.trim(),
    accountIds: JSON.stringify(accountIds),
    accountNames: accountIds.map((id) => accountMap.get(id) ?? id),
    planCount,
    unitCount: planCount,
    creativeCount,
    status,
    progress: failures.length ? 60 : 100,
    createdBy: operator,
    createdAt: new Date().toISOString(),
    failures,
  };

  return NextResponse.json({ data: task });
}
