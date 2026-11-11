export default function RankList({
  items,
  formatValue,
}: {
  items: Array<{ id: string; name: string; value: number; sub?: string }>;
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3.5">
      {items.map((item, index) => (
        <div key={item.id}>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-medium ${
                index < 3 ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              {index + 1}
            </span>
            <span className="truncate text-[12.5px] text-ink-700">{item.name}</span>
            <span className="ml-auto shrink-0 text-[12px] font-medium text-ink-900">
              {formatValue(item.value)}
            </span>
            {item.sub && <span className="shrink-0 text-[10.5px] text-slate-400">{item.sub}</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
