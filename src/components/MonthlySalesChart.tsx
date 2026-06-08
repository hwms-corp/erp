import { useMemo } from 'react';
import { fmt } from '@/types';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  points: ChartPoint[];
  color: string;
  label: string;
}

interface Props {
  series: ChartSeries[];
}

const W = 640;
const H = 300;
const PAD = { top: 28, right: 24, bottom: 36, left: 72 };

function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`;
  return fmt(n);
}

export function MonthlySalesChart({ series }: Props) {
  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const allValues = series.flatMap(s => s.points.map(p => p.value));
    const maxVal = Math.max(...allValues, 1);
    const yMax = maxVal * 1.1;
    const yTicks = 4;

    const lineSeries = series.map(s => {
      const coords = s.points.map((p, i) => {
        const x = PAD.left + (i / Math.max(s.points.length - 1, 1)) * innerW;
        const y = PAD.top + innerH - (p.value / yMax) * innerH;
        return { ...p, x, y };
      });
      const linePath = coords
        .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
        .join(' ');
      return { ...s, coords, linePath };
    });

    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = (yMax / yTicks) * (yTicks - i);
      const y = PAD.top + (i / yTicks) * innerH;
      return { val, y };
    });

    return { lineSeries, yLabels, innerH };
  }, [series]);

  const monthLabels = series[0]?.points.map(p => p.label) ?? [];

  return (
    <div className="w-full overflow-x-auto">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 mb-3 text-xs">
          {series.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[480px] h-auto"
        role="img"
        aria-label="월별 매출·구매 선형 차트"
      >
        {chart.yLabels.map(({ val, y }) => (
          <g key={val}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-400 text-[10px]"
            >
              {fmtAxis(val)}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          y1={PAD.top + chart.innerH}
          x2={W - PAD.right}
          y2={PAD.top + chart.innerH}
          stroke="#cbd5e1"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + chart.innerH}
          stroke="#cbd5e1"
        />

        {chart.lineSeries.map(s => (
          <g key={s.label}>
            <path
              d={s.linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.coords.map(c => (
              <g key={`${s.label}-${c.label}`}>
                <circle cx={c.x} cy={c.y} r={5} fill="white" stroke={s.color} strokeWidth={2.5} />
                <title>{`${s.label} ${c.label}: ${fmt(c.value)}원`}</title>
                {c.value > 0 && (
                  <text
                    x={c.x}
                    y={c.y - 10}
                    textAnchor="middle"
                    className="text-[9px] font-medium"
                    fill={s.color}
                  >
                    {fmtAxis(c.value)}
                  </text>
                )}
              </g>
            ))}
          </g>
        ))}

        {monthLabels.map((label, i) => {
          const innerW = W - PAD.left - PAD.right;
          const x = PAD.left + (i / Math.max(monthLabels.length - 1, 1)) * innerW;
          return (
            <text
              key={label}
              x={x}
              y={H - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
