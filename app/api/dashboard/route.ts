import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { todayStr } from "@/lib/format";
import type { KpiSet } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatRow {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
}

function emptyKpi(): KpiSet {
  return {
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversions: 0,
    revenue: 0,
    ctr: 0,
    cvr: 0,
    cpc: 0,
    cpa: 0,
    roi: 0,
  };
}

function toKpi(rows: StatRow[]): KpiSet {
  const base = rows.reduce(
    (acc, r) => {
      acc.impressions += Number(r.impressions);
      acc.clicks += Number(r.clicks);
      acc.cost += Number(r.cost);
      acc.conversions += Number(r.conversions);
      acc.revenue += Number(r.revenue);
      return acc;
    },
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
  );
  return {
    ...base,
    ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
    cvr: base.clicks > 0 ? base.conversions / base.clicks : 0,
    cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
    cpa: base.conversions > 0 ? base.cost / base.conversions : 0,
    roi: base.cost > 0 ? base.revenue / base.cost : 0,
  };
}

function delta(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return (current - previous) / previous;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = Math.min(90, Math.max(7, Number(searchParams.get("range") ?? 7)));
  const accountId = searchParams.get("accountId") ?? "all";
  const db = getDb();

  const end = todayStr();
  const start = todayStr(-(range - 1));
  const prevEnd = todayStr(-range);
  const prevStart = todayStr(-(range * 2 - 1));

  const accountFilter = accountId !== "all" ? " AND account_id = ?" : "";
  const filterParams = accountId !== "all" ? [accountId] : [];

  const currentRows = db
    .prepare(
      `SELECT date, SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(cost) AS cost,
              SUM(conversions) AS conversions, SUM(revenue) AS revenue
       FROM stats WHERE date BETWEEN ? AND ?${accountFilter}
       GROUP BY date ORDER BY date`
    )
    .all(start, end, ...filterParams) as unknown as StatRow[];

  const prevRows = db
    .prepare(
      `SELECT date, SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(cost) AS cost,
              SUM(conversions) AS conversions, SUM(revenue) AS revenue
       FROM stats WHERE date BETWEEN ? AND ?${accountFilter}
       GROUP BY date ORDER BY date`
    )
    .all(prevStart, prevEnd, ...filterParams) as unknown as StatRow[];

  const accountRows = db
    .prepare(
      `SELECT s.account_id, a.name, a.status, a.daily_budget,
              SUM(s.impressions) AS impressions, SUM(s.clicks) AS clicks, SUM(s.cost) AS cost,
              SUM(s.conversions) AS conversions, SUM(s.revenue) AS revenue
       FROM stats s JOIN accounts a ON a.id = s.account_id
       WHERE s.date BETWEEN ? AND ?${accountId !== "all" ? " AND s.account_id = ?" : ""}
       GROUP BY s.account_id ORDER BY cost DESC`
    )
    .all(start, end, ...filterParams) as unknown as Array<{
    account_id: string;
    name: string;
    status: string;
    daily_budget: number;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    revenue: number;
  }>;

  const planRows = db
    .prepare(
      `SELECT s.plan_id, p.name, p.status, a.name AS account_name,
              SUM(s.impressions) AS impressions, SUM(s.clicks) AS clicks, SUM(s.cost) AS cost,
              SUM(s.conversions) AS conversions, SUM(s.revenue) AS revenue
       FROM stats s
       JOIN plans p ON p.id = s.plan_id
       JOIN accounts a ON a.id = s.account_id
       WHERE s.date BETWEEN ? AND ?${accountId !== "all" ? " AND s.account_id = ?" : ""}
       GROUP BY s.plan_id ORDER BY cost DESC LIMIT 8`
    )
    .all(start, end, ...filterParams) as unknown as Array<{
    plan_id: string;
    name: string;
    status: string;
    account_name: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    revenue: number;
  }>;

  const trendMap = new Map(currentRows.map((r) => [r.date, r]));
  const trend: StatRow[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = todayStr(-i);
    const row = trendMap.get(date);
    trend.push(
      row
        ? {
            date,
            impressions: Number(row.impressions),
            clicks: Number(row.clicks),
            cost: Number(row.cost),
            conversions: Number(row.conversions),
            revenue: Number(row.revenue),
          }
        : { date, impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
    );
  }

  const current = toKpi(currentRows);
  const previous = prevRows.length ? toKpi(prevRows) : emptyKpi();

  const accounts = accountRows.map((r) => ({
    id: r.account_id,
    name: r.name,
    status: r.status,
    dailyBudget: Number(r.daily_budget),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    cost: Number(r.cost),
    conversions: Number(r.conversions),
    revenue: Number(r.revenue),
    roi: Number(r.cost) > 0 ? Number((Number(r.revenue) / Number(r.cost)).toFixed(2)) : 0,
  }));

  const plans = planRows.map((r) => ({
    id: r.plan_id,
    name: r.name,
    status: r.status,
    accountName: r.account_name,
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    cost: Number(r.cost),
    conversions: Number(r.conversions),
    revenue: Number(r.revenue),
    ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
    cpa: Number(r.conversions) > 0 ? Number(r.cost) / Number(r.conversions) : 0,
    roi: Number(r.cost) > 0 ? Number(r.revenue) / Number(r.cost) : 0,
  }));

  return NextResponse.json({
    data: {
      range,
      start,
      end,
      kpi: current,
      prevKpi: previous,
      delta: {
        impressions: delta(current.impressions, previous.impressions),
        clicks: delta(current.clicks, previous.clicks),
        cost: delta(current.cost, previous.cost),
        conversions: delta(current.conversions, previous.conversions),
        revenue: delta(current.revenue, previous.revenue),
        ctr: delta(current.ctr, previous.ctr),
        cvr: delta(current.cvr, previous.cvr),
        cpc: delta(current.cpc, previous.cpc),
        cpa: delta(current.cpa, previous.cpa),
        roi: delta(current.roi, previous.roi),
      },
      trend,
      accounts,
      plans,
    },
  });
}
