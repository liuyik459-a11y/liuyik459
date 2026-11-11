"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { fmtInt, fmtMoney, fmtTime } from "@/lib/format";
import type { Account } from "@/lib/types";

const AVATAR_COLORS = [
  "from-[#4157ff] to-[#2932e1]",
  "from-[#ff9a76] to-[#ff4d4f]",
  "from-[#fcc419] to-[#f08c00]",
  "from-[#38d9a9] to-[#2f9e44]",
  "from-[#da77f2] to-[#7048e8]",
  "from-[#66d9e8] to-[#1098ad]",
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const json = (await res.json()) as { data?: Account[] };
    setAccounts(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async (accountId: string) => {
    setSyncing(accountId);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", accountId }),
    });
    setSyncing(null);
    if (res.ok) {
      setNotice("数据同步完成，已更新最近 7 天投放数据");
      await load();
      setTimeout(() => setNotice(""), 3000);
    } else {
      const json = (await res.json()) as { error?: string };
      setNotice(json.error ?? "同步失败，请检查接入设置");
      setTimeout(() => setNotice(""), 6000);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalToday = accounts.reduce((s, a) => s + (a.todayCost ?? 0), 0);
  const totalWeek = accounts.reduce((s, a) => s + (a.weekCost ?? 0), 0);
  const abnormal = accounts.filter((a) => a.status !== "投放中").length;

  return (
    <div>
      <PageHeader title="账户管理" desc="统一管理百度营销广告主账户、余额与授权状态">
        <button
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          接入新账户
        </button>
        <button
          onClick={() => {
            void Promise.all(accounts.map((a) => sync(a.id)));
          }}
          className="btn-primary flex items-center gap-1.5"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          同步全部
        </button>
      </PageHeader>

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald-700">
          <Icon name="check" className="h-4 w-4" />
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "账户总数", value: `${accounts.length}`, unit: "个", sub: `${abnormal} 个需关注` },
          { label: "账户总余额", value: fmtMoney(totalBalance), unit: "元", sub: "可用于继续投放" },
          { label: "今日消耗", value: fmtMoney(totalToday), unit: "元", sub: "全部账户合计" },
          { label: "近 7 天消耗", value: fmtMoney(totalWeek), unit: "元", sub: "含今日" },
        ].map((s) => (
          <div key={s.label} className="card animate-in p-4">
            <div className="text-[12px] text-ink-500">{s.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[24px] font-semibold leading-none tracking-tight text-ink-900">
                {loading ? "—" : s.value}
              </span>
              <span className="text-[12px] text-ink-500">{s.unit}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-[212px] rounded-2xl" />)
          : accounts.map((a, index) => {
              const percent = a.dailyBudget > 0 ? ((a.todayCost ?? 0) / a.dailyBudget) * 100 : 0;
              return (
                <div key={a.id} className="card animate-in flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                        AVATAR_COLORS[index % AVATAR_COLORS.length]
                      } text-[14px] font-semibold text-white`}
                    >
                      {a.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[14px] font-semibold text-ink-900">{a.name}</h3>
                        <Badge>{a.status}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <span>{a.industry}</span>
                        <span className="text-slate-300">·</span>
                        <span>{a.baiduUserId}</span>
                      </div>
                    </div>
                  </div>

                  {a.authStatus !== "已授权" && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                      <Icon name="bell" className="h-3.5 w-3.5" />
                      授权状态：{a.authStatus}，请重新授权后投放
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10.5px] text-slate-400">账户余额</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink-900">
                        ¥{fmtMoney(a.balance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-400">今日消耗</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink-900">
                        ¥{fmtMoney(a.todayCost ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-400">7 日 ROI</div>
                      <div
                        className={`mt-0.5 text-[14px] font-semibold ${
                          (a.weekRoi ?? 0) >= 2 ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {(a.weekRoi ?? 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1 flex items-center justify-between text-[10.5px] text-slate-400">
                      <span>日预算消耗进度</span>
                      <span>
                        ¥{fmtMoney(a.todayCost ?? 0)} / ¥{fmtMoney(a.dailyBudget)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          percent >= 90
                            ? "bg-rose-500"
                            : percent >= 70
                              ? "bg-amber-400"
                              : "bg-brand-600"
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-[10.5px] text-slate-400">
                      更新于 {fmtTime(a.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void sync(a.id)}
                        disabled={syncing === a.id}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] text-ink-700 transition hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50"
                      >
                        <Icon
                          name="refresh"
                          className={`h-3.5 w-3.5 ${syncing === a.id ? "animate-spin" : ""}`}
                        />
                        同步
                      </button>
                      <span className="text-slate-200">|</span>
                      <span className="px-2 text-[11px] text-slate-400">{a.operator}</span>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <Modal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="接入百度营销账户"
        desc="正式环境通过百度营销开放平台 OAuth 完成授权"
        footer={
          <>
            <button
              onClick={() => setAuthOpen(false)}
              className="rounded-[10px] border border-line px-4 py-2 text-[12.5px] text-ink-700"
            >
              关闭
            </button>
            <button
              onClick={() => {
                setAuthOpen(false);
                setNotice("演示模式：已模拟完成账户授权流程");
                setTimeout(() => setNotice(""), 3000);
              }}
              className="btn-primary"
            >
              模拟授权
            </button>
          </>
        }
      >
        <ol className="space-y-3 text-[12.5px] text-ink-700">
          {[
            "在百度营销开放平台创建应用，获取 AppId 与 AppSecret。",
            "使用广告主账号完成 OAuth 授权，获取 refresh_token。",
            "将凭证写入项目 .env.local，适配层会自动切换为真实接口。",
            "授权完成后，系统自动同步账户余额、计划与近 90 天投放数据。",
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-medium text-brand-600">
                {i + 1}
              </span>
              <span className="leading-5">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11.5px] leading-5 text-slate-500">
          当前为演示模式，账户与投放数据均为本地模拟数据，不会对真实广告账户产生任何影响。
          授权账户数量：<span className="font-medium text-ink-900">{fmtInt(accounts.length)}</span> 个
        </div>
      </Modal>
    </div>
  );
}
