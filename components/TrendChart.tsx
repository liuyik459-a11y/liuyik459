"use client";

import { useId, useMemo, useState } from "react";
import { fmtCompact, shortDate } from "@/lib/format";

const W = 900;
const H = 280;
const PAD = { l: 56, r: 16, t: 16, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

export default function TrendChart({
  points,
  format,
}: {
  points: Array<{ date: string; value: number }>;
  format: (n: number) => string;
}) {
  const gradId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const { max, coords, path, area } = useMemo(() => {
    const rawMax = Math.max(...points.map((p) => p.value), 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const maxValue = Math.ceil(rawMax / magnitude) * magnitude;
    const n = points.length;
    const pts = points.map((p, i) => {
      const x = n === 1 ? PAD.l + PLOT_W / 2 : PAD.l + (i / (n - 1)) * PLOT_W;
      const y = PAD.t + PLOT_H - (p.value / maxValue) * PLOT_H;
      return [x, y] as [number, number];
    });
    let line = "";
    if (pts.length > 0) {
      line = `M ${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const mx = (x0 + x1) / 2;
        line += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
      }
    }
    const areaPath =
      pts.length > 0
        ? `${line} L ${pts[pts.length - 1][0]},${PAD.t + PLOT_H} L ${pts[0][0]},${PAD.t + PLOT_H} Z`
        : "";
    return { max: maxValue, coords: pts, path: line, area: areaPath };
  }, [points]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const ratio = (x - PAD.l) / PLOT_W;
          const idx = Math.round(ratio * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, idx)));
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4157ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4157ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => {
          const y = PAD.t + PLOT_H * g;
          const val = max * (1 - g);
          return (
            <g key={g}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y}
                y2={y}
                stroke="#eef2f8"
                strokeWidth="1"
                strokeDasharray={g === 1 ? "0" : "3 4"}
              />
              <text x={PAD.l - 10} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="11">
                {fmtCompact(val)}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <text
              key={p.date}
              x={coords[i][0]}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize="11"
            >
              {shortDate(p.date)}
            </text>
          ) : null
        )}

        {area && <path d={area} fill={`url(#${gradId})`} />}
        {path && (
          <path d={path} fill="none" stroke="#2932e1" strokeWidth="2.2" strokeLinecap="round" />
        )}

        {hover !== null && coords[hover] && (
          <g>
            <line
              x1={coords[hover][0]}
              x2={coords[hover][0]}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="#c3ccff"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx={coords[hover][0]} cy={coords[hover][1]} r="4.5" fill="#2932e1" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hovered && coords[hover!] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-2.5 py-1.5 shadow-lg"
          style={{
            left: `${(coords[hover!][0] / W) * 100}%`,
            top: `${(coords[hover!][1] / H) * 100 - 2}%`,
          }}
        >
          <div className="text-[10.5px] text-slate-400">{hovered.date}</div>
          <div className="text-[13px] font-semibold text-ink-900">{format(hovered.value)}</div>
        </div>
      )}
    </div>
  );
}
