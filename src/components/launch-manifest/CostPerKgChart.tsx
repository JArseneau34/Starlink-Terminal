import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CostPerKgIndex } from '../../types/launchManifest';
import { getChangeColor } from '../../utils/format';

interface CostPerKgChartProps {
  index: CostPerKgIndex;
}

export function CostPerKgChart({ index }: CostPerKgChartProps) {
  const chartData = useMemo(
    () =>
      index.series.map((p) => ({
        label: p.label,
        usdPerKg: p.usdPerKg,
        benchmark: p.benchmark,
      })),
    [index.series]
  );

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[9px] text-bbg-muted tracking-[0.14em] uppercase">LEO Spot Index</div>
          <div className="text-bbg-amber text-xl font-bold tabular-nums mt-0.5">
            ${index.spot.toLocaleString()}
            <span className="text-bbg-muted text-sm font-normal"> /kg</span>
          </div>
        </div>
        <div className="text-right text-[10px] tabular-nums">
          <div className={getChangeColor(index.changePct30d)}>
            30d {index.changePct30d >= 0 ? '+' : ''}
            {index.changePct30d.toFixed(1)}%
          </div>
          <div className={`mt-0.5 ${getChangeColor(index.changePctYtd)}`}>
            YTD {index.changePctYtd >= 0 ? '+' : ''}
            {index.changePctYtd.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[120px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="costKgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3de8ff" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#3de8ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: '#888', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#888', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                background: '#111',
                border: '1px solid #333',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
              labelStyle={{ color: '#3de8ff' }}
              formatter={(value, _name, item) => [
                `$${Number(value).toLocaleString()}/kg`,
                item.payload.benchmark as string,
              ]}
            />
            <Area
              type="monotone"
              dataKey="usdPerKg"
              stroke="#3de8ff"
              fill="url(#costKgGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[9px] text-bbg-muted leading-snug">
        Composite benchmark — blended Falcon 9 ride-share, dedicated, and emerging medium-lift quotes to
        LEO. Not a traded instrument.
      </div>
    </div>
  );
}
