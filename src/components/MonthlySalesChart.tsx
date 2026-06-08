import { useMemo } from 'react';
import { fmt } from '@/types';

export interface ChartPoint {
  label: string;
  value: number;
}

interface Props {
  points: ChartPoint[];
  color?: string;
}

const W = 640;
const H = 300;
const PAD = { top: 28, right: 24, bottom: 36, left: 72 };

function fmtAxis(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return fmt(n);
}

export function MonthlySalesChart({ points, color = '#4f46e5' }: Props) {
  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const maxVal = Math.max(...points.map(p => p.value), 1);
    const yMax = maxVal * 1.1;
    const yTicks = 4;

    const coords = points.map((p, i) => {
      const x = PAD.left + (i / Math.max(points.length - 1, 1)) * innerW;
      const y = PAD.top + innerH - (p.value / yMax) * innerH;
      return { ...p, x, y };
    });

    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
      .join(' ');

    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = (yMax / yTicks) * (yTicks - i);
      const y = PAD.top + (i / yTicks) * innerH;
      return { val, y };
    });

    return { coords, linePath, yLabels, innerW, innerH, yMax };
  }, [points]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[480px] h-auto"
        role="img"
        aria-label="월별 매출 선형 차트"
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

        <path
          d={chart.linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {chart.coords.map(c => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r={5} fill="white" stroke={color} strokeWidth={2.5} />
            <title>{`${c.label}: ${fmt(c.value)}원`}</title>
            {c.value > 0 && (
              <text
                x={c.x}
                y={c.y - 10}
                textAnchor="middle"
                className="fill-indigo-600 text-[9px] font-medium"
              >
                {fmtAxis(c.value)}
              </text>
            )}
            <text
              x={c.x}
              y={H - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
