"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { fmtMoney, fmtTime } from "@/lib/format";
import type { Account, BatchTask, Material } from "@/lib/types";

const TARGETING_PRESETS = [
  "全国 · 18-45岁 · 移动端 · 全时段",
  "一二线城市 · 25-40岁 · iOS优先 · 8:00-24:00",
  "广东/江苏/浙江 · 18-30岁 · 女性 · 全时段",
  "全国 · 20-45岁 · 兴趣人群包 · 9:00-23:00",
  "全国 · 18-35岁 · 安卓优先 · 夜间溢价 20%",
];

interface TaskItem extends BatchTask {
  accountNames: string[];
}

export default function BatchPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [name, setName] = useState("秋冬爆品批量拉新");
  const [plansPerAccount, setPlansPerAccount] = useState(3);
  const [pattern, setPattern] = useState("{账户}-{日期}-{序号}-信息流");
  const [budget, setBudget] = useState(800);
  const [bid, setBid] = useState(0.8);
  const [targeting, setTargeting] = useState(TARGETING_PRESETS[0]);
  const [titlesText, setTitlesText] = useState(
    "限时直降，爆款好物现在下单更划算\n同款热卖，库存有限先到先得"
  );
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [accRes, matRes, taskRes] = await Promise.all([
      fetch("/api/accounts", { cache: "no-store" }),
      fetch("/api/materials", { cache: "no-store" }),
      fetch("/api/batch", { cache: "no-store" }),
    ]);
    const acc = (await accRes.json()) as { data?: Account[] };
    const mat = (await matRes.json()) as { data?: Material[] };
    const task = (await taskRes.json()) as { data?: TaskItem[] };
    setAccounts(acc.data ?? []);
    setMaterials((mat.data ?? []).filter((m) => m.status === "可用"));
    setTasks(task.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const planCount = selectedAccounts.length * plansPerAccount;
  const creativePerPlan = Math.min(2, Math.max(1, selectedMaterials.length));
  const creativeCount = planCount * creativePerPlan;

  const canSubmit = useMemo(
    () => name.trim().length > 0 && selectedAccounts.length > 0 && budget > 0 && !submitting,
    [name, selectedAccounts, budget, submitting]
  );

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    const titles = titlesText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3);

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        accountIds: selectedAccounts,
        plansPerAccount,
        planNamePattern: pattern,
        budget,
        bid,
        targeting,
        materialIds: selectedMaterials,
        creativeTitles: titles,
      }),
    });
    const json = (await res.json()) as { data?: TaskItem; error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "创建失败，请稍后重试");
      return;
    }
    setNotice(
      `任务「${name}」已提交：${json.data?.accountNames.length ?? 0} 个账户，创建 ${json.data?.planCount ?? 0} 条计划、${json.data?.creativeCount ?? 0} 条创意`
    );
    await load();
  };

  return (
    <div>
      <PageHeader title="批量投放" desc="模板化批量创建计划与创意，一次覆盖多个广告主账户">
        <span className="flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-[11.5px] text-brand-600">
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          命名支持 {'{账户}'} {'{日期}'} {'{序号}'}
        </span>
      </PageHeader>

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-700">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">提交成功</div>
            <div className="mt-0.5 text-emerald-600">{notice}</div>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] text-rose-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold text-ink-900">创建投放任务</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              填写一次，系统按账户自动拆分并批量下发到百度营销后台
            </p>
          </div>

          <div className="space-y-5 px-5 py-5">
            <section>
              <SectionTitle index="01" title="基础信息" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="任务名称">
                  <input
                    className="input-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：双11 服饰批量拉新"
                  />
                </Field>
                <Field label="每个账户计划数">
                  <select
                    className="input-base"
                    value={plansPerAccount}
                    onChange={(e) => setPlansPerAccount(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} 条
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="计划命名规则">
                  <input
                    className="input-base"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
                </Field>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  示例：{pattern
                    .replace("{账户}", "创量优品旗舰店")
                    .replace("{日期}", new Date().toISOString().slice(0, 10).replace(/-/g, ""))
                    .replace("{序号}", "01")}
                </p>
              </div>
            </section>

            <section>
              <SectionTitle index="02" title="投放账户" extra={`已选 ${selectedAccounts.length} 个`} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {accounts.map((a) => {
                  const active = selectedAccounts.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(selectedAccounts, setSelectedAccounts, a.id)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-50/60"
                          : "border-line bg-white hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {active && <Icon name="check" className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink-900">
                          {a.name}
                        </span>
                        <span className="block text-[10.5px] text-slate-400">
                          {a.industry} · 余额 ¥{fmtMoney(a.balance)}
                        </span>
                      </span>
                      <Badge>{a.status}</Badge>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <SectionTitle index="03" title="投放设置" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="单计划日预算（元）">
                  <input
                    type="number"
                    min={1}
                    className="input-base"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  />
                </Field>
                <Field label="出价（元）">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className="input-base"
                    value={bid}
                    onChange={(e) => setBid(Number(e.target.value))}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="定向模板">
                  <select
                    className="input-base"
                    value={targeting}
                    onChange={(e) => setTargeting(e.target.value)}
                  >
                    {TARGETING_PRESETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section>
              <SectionTitle index="04" title="创意设置" extra={`已选 ${selectedMaterials.length} 个素材`} />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {materials.map((m) => {
                  const active = selectedMaterials.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(selectedMaterials, setSelectedMaterials, m.id)}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        active
                          ? "border-brand-300 ring-2 ring-brand-100"
                          : "border-line hover:border-slate-300"
                      }`}
                    >
                      <div
                        className="relative flex h-16 items-center justify-center"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${m.colorA}, ${m.colorB})`,
                        }}
                      >
                        <Icon name={m.type === "视频" ? "play" : "image"} className="h-4 w-4 text-white/90" />
                        <span className="absolute bottom-1 left-1.5 rounded bg-black/25 px-1 py-0.5 text-[9.5px] text-white">
                          {m.type}
                        </span>
                        {active && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-brand-600">
                            <Icon name="check" className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <div className="bg-white px-2 py-1.5">
                        <div className="truncate text-[11.5px] font-medium text-ink-900">{m.title}</div>
                        <div className="text-[10px] text-slate-400">{m.size}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <Field label="创意标题（每行一条，最多 3 条）">
                  <textarea
                    rows={3}
                    className="input-base resize-none"
                    value={titlesText}
                    onChange={(e) => setTitlesText(e.target.value)}
                  />
                </Field>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t border-line bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] text-ink-500">
              预计创建
              <span className="mx-1 font-semibold text-brand-600">{planCount}</span>
              条计划
              <span className="mx-1 text-slate-300">/</span>
              <span className="mx-1 font-semibold text-brand-600">{creativeCount}</span>
              条创意
              <span className="ml-2 text-[11px] text-slate-400">
                覆盖 {selectedAccounts.length} 个账户
              </span>
            </div>
            <button onClick={() => void submit()} disabled={!canSubmit} className="btn-primary">
              {submitting ? "提交中..." : "提交批量创建"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-[13.5px] font-semibold text-ink-900">投放流程</h3>
            <ol className="mt-3 space-y-3">
              {[
                ["选择账户", "支持跨账户合并下发，自动读取余额与授权状态"],
                ["配置模板", "预算、出价、定向与命名规则统一配置"],
                ["批量下发", "逐账户创建计划与创意，失败项单独记录"],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10.5px] font-semibold text-brand-600">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[12px] font-medium text-ink-900">{t}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-[13.5px] font-semibold text-ink-900">最近任务</h3>
              <span className="text-[11px] text-slate-400">{tasks.length} 条</span>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
              {tasks.length === 0 && (
                <p className="py-8 text-center text-[11.5px] text-slate-400">暂无任务记录</p>
              )}
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-900">
                      {t.name}
                    </span>
                    <Badge>{t.status}</Badge>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400">
                    {t.accountNames.join("、")}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-500">
                    <span>计划 {t.planCount}</span>
                    <span>创意 {t.creativeCount}</span>
                    <span className="ml-auto text-slate-400">{fmtTime(t.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  index,
  title,
  extra,
}: {
  index: string;
  title: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] font-semibold tracking-wider text-brand-600">{index}</span>
      <span className="text-[13px] font-semibold text-ink-900">{title}</span>
      {extra && (
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">
          {extra}
        </span>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] text-ink-500">{label}</span>
      {children}
    </label>
  );
}
