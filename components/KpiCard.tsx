import Icon from "./Icon";

export default function KpiCard({
  label,
  value,
  unit,
  delta,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  hint?: string;
  highlight?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className={`card animate-in p-4 ${
        highlight ? "border-brand-200 bg-gradient-to-br from-white to-brand-50/60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-500">{label}</span>
        {typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium ${
              up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            <Icon name={up ? "arrowUp" : "arrowDown"} className="h-3 w-3" />
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[25px] font-semibold leading-none tracking-tight text-ink-900">
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-500">{unit}</span>}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">{hint ?? "较上一周期"}</div>
    </div>
  );
}
