import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBaiduAdapter } from "@/lib/baidu";
import { todayStr } from "@/lib/format";
import type { Account } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AccountRow {
  id: string;
  name: string;
  baidu_user_id: string;
  industry: string;
  status: string;
  balance: number;
  daily_budget: number;
  auth_status: string;
  operator: string;
  updated_at: string;
}

export async function GET() {
  const db = getDb();
  const since = todayStr(-6);
  const today = todayStr();

  const rows = db.prepare("SELECT * FROM accounts ORDER BY id").all() as unknown as AccountRow[];

  const week = db
    .prepare(
      `SELECT account_id, SUM(cost) AS cost, SUM(revenue) AS revenue
       FROM stats WHERE date >= ? GROUP BY account_id`
    )
    .all(since) as unknown as Array<{ account_id: string; cost: number; revenue: number }>;

  const todayRows = db
    .prepare(
      `SELECT account_id, SUM(cost) AS cost FROM stats WHERE date = ? GROUP BY account_id`
    )
    .all(today) as unknown as Array<{ account_id: string; cost: number }>;

  const weekMap = new Map(week.map((w) => [w.account_id, w]));
  const todayMap = new Map(todayRows.map((w) => [w.account_id, w]));

  const data: Account[] = rows.map((r) => {
    const wk = weekMap.get(r.id);
    const td = todayMap.get(r.id);
    const weekCost = Number(wk?.cost ?? 0);
    const weekRevenue = Number(wk?.revenue ?? 0);
    return {
      id: r.id,
      name: r.name,
      baiduUserId: r.baidu_user_id,
      industry: r.industry,
      status: r.status,
      balance: Number(r.balance),
      dailyBudget: Number(r.daily_budget),
      authStatus: r.auth_status,
      operator: r.operator,
      updatedAt: r.updated_at,
      todayCost: Number(td?.cost ?? 0),
      weekCost,
      weekRoi: weekCost > 0 ? Number((weekRevenue / weekCost).toFixed(2)) : 0,
    };
  });

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string; accountId?: string };
  if (body.action !== "sync" || !body.accountId) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const result = await getBaiduAdapter().syncAccount(body.accountId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message || "同步失败：请检查接入设置与授权状态" },
      { status: 502 }
    );
  }
  return NextResponse.json({ data: result });
}
