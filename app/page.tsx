"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import RankList from "@/components/RankList";
import TrendChart from "@/components/TrendChart";
import { fmtCompact, fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import type { Account, DailyPoint, KpiSet } from "@/lib/types";

interface DashboardData {
  range: number;
  start: string;
  end: string;
  kpi: KpiSet;
  delta: Record<keyof KpiSet, number>;
  trend: DailyPoint[];
  accounts: Array<{
    id: string;
    name: string;
    status: string;
    dailyBudget: number;
    cost: number;
    conversions: number;
    revenue: number;
    roi: number;
  }>;
  plans: Array<{
    id: string;
    name: string;
    status: string;
    accountName: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpa: number;
    roi: number;
  }>;
}

const RANGES = [
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
  { value: 90, label: "近 90 天" },
];

const METRICS = [
  { key: "cost", label: "消耗", type: "money" },
  { key: "revenue", label: "成交金额", type: "money" },
  { key: "conversions", label: "转化数", type: "int" },
  { key: "impressions", label: "展现量", type: "int" },
  { key: "clicks", label: "点击量", type: "int" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export default function DashboardPage() {
  const [range, setRange] = useState(7);
  const [accountId, setAccountId] = useState("all");
  const [metric, setMetric] = useState<MetricKey>("cost");
  const [data, setData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [dashRes, accRes] = await Promise.all([
      fetch(`/api/dashboard?range=${range}&accountId=${accountId}`, { cache: "no-store" }),
      fetch("/api/accounts", { cache: "no-store" }),
    ]);
    const dash = (await dashRes.json()) as { data?: DashboardData };
    const acc = (await accRes.json()) as { data?: Account[] };
    if (dash.data) setData(dash.data);
    if (acc.data) setAccounts(acc.data);
    setLoading(false);
  }, [range, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const points = useMemo(() => {
    if (!data) return [];
    return data.trend.map((p) => ({ date: p.date, value: p[metric] }));
  }, [data, metric]);

  const metricMeta = METRICS.find((m) => m.key === metric)!;
  const chartFormat = (n: number) =>
    metricMeta.type === "money" ? `¥${fmtMoney(n)}` : fmtInt(n);

  return (
    <div>
      <PageHeader
        title="数据看板"
        desc="百度信息流投放效果总览 · 演示数据，接入营销 API 后自动切换为真实数据"
      >
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="input-base !w-auto !py-2 text-[12.5px]"
        >
          <option value="all">全部账户</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-[10px] border border-line bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-lg px-3 py-1.5 text-[12px] transition ${
                range === r.value
                  ? "bg-brand-600 font-medium text-white"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="消耗"
          value={data ? fmtMoney(data.kpi.cost) : "—"}
          unit="元"
          delta={data?.delta.cost}
          highlight
        />
        <KpiCard
          label="成交金额"
          value={data ? fmtMoney(data.kpi.revenue) : "—"}
          unit="元"
          delta={data?.delta.revenue}
        />
        <KpiCard
          label="ROI"
          value={data ? data.kpi.roi.toFixed(2) : "—"}
          delta={data?.delta.roi}
        />
        <KpiCard
          label="展现量"
          value={data ? fmtCompact(data.kpi.impressions) : "—"}
          unit="次"
          delta={data?.delta.impressions}
        />
        <KpiCard
          label="点击率"
          value={data ? fmtPercent(data.kpi.ctr) : "—"}
          delta={data?.delta.ctr}
        />
        <KpiCard
          label="转化数"
          value={data ? fmtInt(data.kpi.conversions) : "—"}
          unit="个"
          delta={data?.delta.conversions}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-ink-900">投放趋势</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {data ? `${data.start} 至 ${data.end}` : "加载中"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-[10px] bg-slate-50 p-0.5">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] transition ${
                    metric === m.key
                      ? "bg-white font-medium text-brand-600 shadow-sm"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {loading || !data ? (
            <div className="skeleton h-[240px] w-full rounded-xl" />
          ) : (
            <TrendChart points={points} format={chartFormat} />
          )}
        </div>

        <div className="card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-ink-900">账户消耗排行</h2>
            <span className="text-[11px] text-slate-400">按消耗</span>
          </div>
          {loading || !data ? (
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-8 rounded-lg" />
              ))}
            </div>
          ) : data.accounts.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-slate-400">暂无数据</p>
          ) : (
            <RankList
              items={data.accounts.map((a) => ({
                id: a.id,
                name: a.name,
                value: a.cost,
                sub: `ROI ${a.roi.toFixed(2)}`,
              }))}
              formatValue={(n) => `¥${fmtMoney(n)}`}
            />
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink-900">计划消耗 TOP 8</h2>
          <span className="text-[11px] text-slate-400">共 {data?.plans.length ?? 0} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-y border-line bg-slate-50/60 text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 text-left font-medium">计划名称</th>
                <th className="px-4 py-2.5 text-left font-medium">账户</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">展现量</th>
                <th className="px-4 py-2.5 text-right font-medium">点击率</th>
                <th className="px-4 py-2.5 text-right font-medium">消耗</th>
                <th className="px-4 py-2.5 text-right font-medium">转化</th>
                <th className="px-4 py-2.5 text-right font-medium">转化成本</th>
                <th className="px-4 py-2.5 text-right font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data?.plans.map((p) => (
                <tr key={p.id} className="border-b border-line/70 transition hover:bg-slate-50/70">
                  <td className="max-w-[240px] truncate px-4 py-3 font-medium text-ink-900">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-ink-500">{p.accountName}</td>
                  <td className="px-4 py-3">
                    <Badge>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-700">{fmtCompact(p.impressions)}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{fmtPercent(p.ctr)}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink-900">
                    ¥{fmtMoney(p.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-700">{fmtInt(p.conversions)}</td>
                  <td className="px-4 py-3 text-right text-ink-700">
                    ¥{p.cpa > 0 ? fmtMoney(p.cpa) : "-"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      p.roi >= 1 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {p.roi.toFixed(2)}
                  </td>
                </tr>
              ))}
              {!loading && !data?.plans.length && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[12px] text-slate-400">
                    暂无投放数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
