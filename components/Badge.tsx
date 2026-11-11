const STYLES: Record<string, string> = {
  投放中: "bg-emerald-50 text-emerald-600 border-emerald-100",
  已完成: "bg-emerald-50 text-emerald-600 border-emerald-100",
  可用: "bg-emerald-50 text-emerald-600 border-emerald-100",
  已授权: "bg-emerald-50 text-emerald-600 border-emerald-100",
  启用: "bg-emerald-50 text-emerald-600 border-emerald-100",
  审核中: "bg-amber-50 text-amber-600 border-amber-100",
  部分失败: "bg-amber-50 text-amber-600 border-amber-100",
  待重新授权: "bg-amber-50 text-amber-600 border-amber-100",
  暂停: "bg-slate-100 text-slate-500 border-slate-200",
  停用: "bg-slate-100 text-slate-500 border-slate-200",
  已驳回: "bg-rose-50 text-rose-600 border-rose-100",
  余额不足: "bg-rose-50 text-rose-600 border-rose-100",
};

export default function Badge({
  children,
  tone,
}: {
  children: string;
  tone?: keyof typeof STYLES;
}) {
  const cls = STYLES[tone ?? children] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] leading-4 ${cls}`}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
