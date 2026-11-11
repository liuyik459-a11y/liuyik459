"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

const NAV: Array<{ group: string; items: Array<{ href: string; label: string; icon: IconName }> }> = [
  {
    group: "投放管理",
    items: [
      { href: "/", label: "数据看板", icon: "dashboard" },
      { href: "/batch", label: "批量投放", icon: "send" },
      { href: "/materials", label: "素材与创意", icon: "image" },
      { href: "/rules", label: "自动化规则", icon: "zap" },
    ],
  },
  {
    group: "账户与记录",
    items: [
      { href: "/accounts", label: "账户管理", icon: "wallet" },
      { href: "/settings", label: "接入设置", icon: "settings" },
      { href: "/logs", label: "操作日志", icon: "history" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col bg-[#0b1220] lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 text-[15px] font-bold text-white shadow-lg shadow-brand-600/30">
            创
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-wide text-white">创量投放</div>
            <div className="text-[10px] tracking-[0.18em] text-slate-500">FEED ADS</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2">
          {NAV.map((group) => (
            <div key={group.group} className="mb-5">
              <div className="px-3 pb-2 text-[10px] font-medium tracking-[0.14em] text-slate-600">
                {group.group}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] transition ${
                        active
                          ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      }`}
                    >
                      <Icon name={item.icon} className="h-[17px] w-[17px]" />
                      <span>{item.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-[12px] text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            本地运行 · 不消耗 token
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
            接入百度接口时只使用本机网络
          </p>
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-[12px] font-medium text-white">
            张
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-slate-200">运营小张</div>
            <div className="text-[10px] text-slate-500">投放运营 · 管理员</div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-bold text-white">
              创
            </div>
            <span className="text-[14px] font-semibold">创量投放</span>
            <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-600">
              本地运行
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.flatMap((g) => g.items).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] ${
                    active ? "bg-brand-600 text-white" : "text-ink-500"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-[1560px] px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
