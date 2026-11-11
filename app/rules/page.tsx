"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { fmtTime } from "@/lib/format";
import type { Rule } from "@/lib/types";

const METRICS = ["消耗", "转化成本", "ROI", "账户余额", "时段消耗", "点击率", "转化数"];
const OPERATORS = [">", ">=", "<", "<="];
const ACTIONS = [
  "暂停计划",
  "出价下调 10%",
  "出价上调 10%",
  "日预算上调 20%",
  "日预算下调 20%",
  "发送飞书通知",
  "暂停 00:00-07:00",
];
const SCOPES = ["全部账户", "服饰鞋包账户", "美妆个护账户", "3C 数码账户", "食品生鲜账户"];

const EMPTY_FORM = {
  name: "",
  metric: "消耗",
  operator: ">",
  threshold: 800,
  action: "暂停计划",
  scope: "全部账户",
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/rules", { cache: "no-store" });
    const json = (await res.json()) as { data?: Rule[] };
    setRules(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const enabled = rules.filter((r) => r.status === "启用").length;
    const triggered = rules.reduce((s, r) => s + r.triggeredCount, 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayTriggered = rules.filter(
      (r) => r.lastTriggeredAt && r.lastTriggeredAt.slice(0, 10) === today
    ).length;
    return { enabled, triggered, todayTriggered };
  }, [rules]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await load();
    setBusyId(null);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleting.id }),
    });
    setDeleting(null);
    await load();
  };

  return (
    <div>
      <PageHeader title="自动化规则" desc="按消耗、转化、ROI 等指标自动执行调控动作，减少人工盯盘">
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Icon name="plus" className="h-3.5 w-3.5" />
          新建规则
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "规则总数", value: `${rules.length}`, unit: "条" },
          { label: "启用中", value: `${stats.enabled}`, unit: "条" },
          { label: "累计触发", value: `${stats.triggered}`, unit: "次" },
          { label: "今日触发", value: `${stats.todayTriggered}`, unit: "条规则" },
        ].map((s) => (
          <div key={s.label} className="card animate-in p-4">
            <div className="text-[12px] text-ink-500">{s.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[24px] font-semibold leading-none tracking-tight text-ink-900">
                {loading ? "—" : s.value}
              </span>
              <span className="text-[12px] text-ink-500">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <Icon name="zap" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-[11.5px] leading-5 text-brand-700">
          正式环境规则由调度服务每 10 分钟扫描一次；演示模式下请在规则右侧点击「执行一次」模拟触发，
          所有触发都会写入操作日志。
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {loading &&
          [0, 1, 2].map((i) => <div key={i} className="skeleton h-[92px] rounded-2xl" />)}

        {!loading &&
          rules.map((r) => {
            const enabled = r.status === "启用";
            return (
              <div
                key={r.id}
                className={`card animate-in flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${
                  enabled ? "" : "opacity-75"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    enabled ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon name="zap" className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[13.5px] font-semibold text-ink-900">{r.name}</h3>
                    <Badge>{r.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5">
                      当 {r.metric} {r.operator} {r.threshold}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-600">
                      {r.action}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>{r.scope}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
                    <span>已触发 {r.triggeredCount} 次</span>
                    <span>最近触发：{fmtTime(r.lastTriggeredAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => void patch(r.id, { run: true })}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-50"
                  >
                    <Icon name="play" className="h-3 w-3" />
                    执行一次
                  </button>
                  <button
                    onClick={() => setDeleting(r)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                    aria-label="删除规则"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void patch(r.id, { status: enabled ? "停用" : "启用" })}
                    disabled={busyId === r.id}
                    className={`relative h-5 w-9 rounded-full transition ${
                      enabled ? "bg-brand-600" : "bg-slate-300"
                    }`}
                    aria-label={enabled ? "停用规则" : "启用规则"}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        enabled ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}

        {!loading && rules.length === 0 && (
          <div className="card py-16 text-center text-[12px] text-slate-400">
            还没有规则，点击右上角「新建规则」创建第一条
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建自动化规则"
        desc="满足条件时自动执行动作，规则保存后默认启用"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="rounded-[10px] border border-line px-4 py-2 text-[12.5px] text-ink-700"
            >
              取消
            </button>
            <button onClick={() => void submit()} disabled={saving} className="btn-primary">
              {saving ? "保存中..." : "保存并启用"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">规则名称</span>
            <input
              className="input-base"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：转化成本过高自动降价"
            />
          </label>

          <div className="rounded-xl border border-line p-3">
            <div className="text-[11.5px] font-medium text-ink-700">执行条件</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select
                className="input-base"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
              >
                {METRICS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <select
                className="input-base"
                value={form.operator}
                onChange={(e) => setForm({ ...form, operator: e.target.value })}
              >
                {OPERATORS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <input
                type="number"
                className="input-base"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              />
            </div>
            <p className="mt-2 text-[10.5px] text-slate-400">
              {form.metric === "ROI" || form.metric === "点击率"
                ? "提示：ROI 阈值填 2 表示 ROI 为 2，点击率填 0.02 表示 2%"
                : "提示：消耗、转化成本、余额单位均为元"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-ink-500">执行动作</span>
              <select
                className="input-base"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
              >
                {ACTIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-ink-500">生效范围</span>
              <select
                className="input-base"
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                {SCOPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="删除规则"
        width="max-w-sm"
        footer={
          <>
            <button
              onClick={() => setDeleting(null)}
              className="rounded-[10px] border border-line px-4 py-2 text-[12.5px] text-ink-700"
            >
              取消
            </button>
            <button
              onClick={() => void remove()}
              className="rounded-[10px] bg-rose-500 px-4 py-2 text-[12.5px] text-white transition hover:bg-rose-600"
            >
              确认删除
            </button>
          </>
        }
      >
        <p className="text-[12.5px] leading-6 text-ink-700">
          确定删除规则「{deleting?.name}」吗？删除后不再执行，历史操作日志会保留。
        </p>
      </Modal>
    </div>
  );
}
