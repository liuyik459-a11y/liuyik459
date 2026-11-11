"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { fmtTime } from "@/lib/format";
import type { LogItem } from "@/lib/types";

const FILTERS = ["全部", "批量创建", "规则触发", "数据同步", "素材上传", "计划调整", "账户授权"];

const META: Record<string, { icon: IconName; color: string; bg: string }> = {
  批量创建: { icon: "send", color: "text-brand-600", bg: "bg-brand-50" },
  规则触发: { icon: "zap", color: "text-amber-600", bg: "bg-amber-50" },
  数据同步: { icon: "refresh", color: "text-cyan-600", bg: "bg-cyan-50" },
  素材上传: { icon: "image", color: "text-violet-600", bg: "bg-violet-50" },
  计划调整: { icon: "filter", color: "text-emerald-600", bg: "bg-emerald-50" },
  账户授权: { icon: "wallet", color: "text-rose-500", bg: "bg-rose-50" },
  规则创建: { icon: "plus", color: "text-brand-600", bg: "bg-brand-50" },
  规则状态: { icon: "check", color: "text-slate-500", bg: "bg-slate-100" },
  规则删除: { icon: "trash", color: "text-rose-500", bg: "bg-rose-50" },
};

const FALLBACK = { icon: "history" as IconName, color: "text-slate-500", bg: "bg-slate-100" };

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState("全部");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/logs", { cache: "no-store" });
    const json = (await res.json()) as { data?: LogItem[] };
    setLogs(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === "全部" ? logs : logs.filter((l) => l.action === filter)),
    [logs, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LogItem[]>();
    for (const log of filtered) {
      const day = log.createdAt.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(log);
      map.set(day, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <PageHeader title="操作日志" desc="记录投放动作、规则触发与账户变更，便于回溯与协作">
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
              filter === f
                ? "border-brand-200 bg-brand-50 font-medium text-brand-600"
                : "border-line bg-white text-ink-500 hover:text-ink-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-5">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="py-16 text-center text-[12px] text-slate-400">该分类下暂无操作记录</p>
        )}

        {!loading &&
          grouped.map(([day, items]) => (
            <div key={day} className="mb-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">{day}</span>
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10.5px] text-slate-300">{items.length} 条</span>
              </div>
              <div className="space-y-2">
                {items.map((log) => {
                  const meta = META[log.action] ?? FALLBACK;
                  return (
                    <div
                      key={log.id}
                      className="flex gap-3 rounded-xl border border-transparent px-2 py-2.5 transition hover:border-line hover:bg-slate-50/60"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}
                      >
                        <Icon name={meta.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-medium ${meta.color}`}>{log.action}</span>
                          <span className="text-[12.5px] font-medium text-ink-900">{log.target}</span>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">{log.detail}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10.5px] text-slate-400">{fmtTime(log.createdAt)}</div>
                        <div className="mt-0.5 text-[10.5px] text-slate-400">{log.operator}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
