"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { fmtPercent, fmtTime } from "@/lib/format";
import type { Material } from "@/lib/types";

interface CreativeItem {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  materialTitle: string;
  materialType: string;
  colorA: string;
  colorB: string;
  planName: string;
  accountName: string;
}

const TYPES = ["全部", "图片", "视频", "图文"];

export default function MaterialsPage() {
  const [tab, setTab] = useState<"library" | "creative">("library");
  const [type, setType] = useState("全部");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [creatives, setCreatives] = useState<CreativeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", type: "图片", size: "1080×1080", tag: "服饰" });

  const load = useCallback(async () => {
    setLoading(true);
    const [m, c] = await Promise.all([
      fetch("/api/materials", { cache: "no-store" }),
      fetch("/api/creatives", { cache: "no-store" }),
    ]);
    const mj = (await m.json()) as { data?: Material[] };
    const cj = (await c.json()) as { data?: CreativeItem[] };
    setMaterials(mj.data ?? []);
    setCreatives(cj.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (type === "全部" ? materials : materials.filter((m) => m.type === type)),
    [materials, type]
  );

  const avgCtr = materials.length
    ? materials.reduce((s, m) => s + m.ctr, 0) / materials.length
    : 0;
  const usable = materials.filter((m) => m.status === "可用").length;

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setForm({ title: "", type: "图片", size: "1080×1080", tag: "服饰" });
      await load();
    }
  };

  return (
    <div>
      <PageHeader title="素材与创意" desc="集中管理图片、视频素材，组合生成信息流创意">
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Icon name="plus" className="h-3.5 w-3.5" />
          新增素材
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "素材总数", value: `${materials.length}`, unit: "个" },
          { label: "可用素材", value: `${usable}`, unit: "个" },
          { label: "平均点击率", value: fmtPercent(avgCtr), unit: "" },
          { label: "创意组合", value: `${creatives.length}`, unit: "条" },
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-[10px] border border-line bg-white p-0.5">
          {[
            { key: "library" as const, label: "素材库" },
            { key: "creative" as const, label: "创意组合" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] transition ${
                tab === t.key
                  ? "bg-brand-600 font-medium text-white"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <div className="flex gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                  type === t
                    ? "border-brand-200 bg-brand-50 font-medium text-brand-600"
                    : "border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "library" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[232px] rounded-2xl" />)}
          {!loading &&
            filtered.map((m) => (
              <div key={m.id} className="card animate-in overflow-hidden">
                <div
                  className="relative flex h-[128px] items-center justify-center"
                  style={{ backgroundImage: `linear-gradient(135deg, ${m.colorA}, ${m.colorB})` }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                    <Icon
                      name={m.type === "视频" ? "play" : "image"}
                      className="h-5 w-5 text-white"
                    />
                  </div>
                  <span className="absolute left-2 top-2 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
                    {m.type}
                  </span>
                  <span className="absolute right-2 top-2">
                    <Badge>{m.status}</Badge>
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
                    {m.size}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="truncate text-[12.5px] font-medium text-ink-900">{m.title}</h3>
                  <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-slate-400">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{m.tag}</span>
                    <span>点击率 {fmtPercent(m.ctr)}</span>
                    <span>已用 {m.usedCount} 次</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                    <span className="text-[10.5px] text-slate-400">{fmtTime(m.createdAt)}</span>
                    <button className="flex items-center gap-1 text-[11px] text-brand-600 transition hover:text-brand-700">
                      用于投放
                      <Icon name="external" className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-[12px] text-slate-400">
              该类型下暂无素材
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-[120px] rounded-2xl" />)}
          {!loading &&
            creatives.map((c) => (
              <div key={c.id} className="card flex gap-3 p-3">
                <div
                  className="flex h-[92px] w-[104px] shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundImage: `linear-gradient(135deg, ${c.colorA}, ${c.colorB})` }}
                >
                  <Icon
                    name={c.materialType === "视频" ? "play" : "image"}
                    className="h-5 w-5 text-white/90"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-[12.5px] font-medium leading-5 text-ink-900">
                      {c.title}
                    </h3>
                    <Badge>{c.status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {c.materialTitle} · {c.planName}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-400">
                    <span className="truncate">{c.accountName}</span>
                    <span className="ml-auto shrink-0">{fmtTime(c.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          {!loading && creatives.length === 0 && (
            <div className="col-span-full py-16 text-center text-[12px] text-slate-400">
              暂无创意，去「批量投放」创建吧
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增素材"
        desc="演示模式下素材仅入库登记，接入百度 API 后可自动上传审核"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="rounded-[10px] border border-line px-4 py-2 text-[12.5px] text-ink-700"
            >
              取消
            </button>
            <button onClick={() => void submit()} disabled={saving} className="btn-primary">
              {saving ? "提交中..." : "提交审核"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">素材名称</span>
            <input
              className="input-base"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如：双11 主推款主图"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-ink-500">素材类型</span>
              <select
                className="input-base"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option>图片</option>
                <option>视频</option>
                <option>图文</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-ink-500">尺寸</span>
              <input
                className="input-base"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">行业标签</span>
            <select
              className="input-base"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            >
              {["服饰", "美妆", "食品", "3C", "家居", "保健", "鞋靴", "其他"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
