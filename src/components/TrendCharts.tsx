import { LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip } from 'recharts';
import { getTrendData, DailyTrendData } from '@/lib/calculations';
import { useData } from '@/hooks/useData';
import { Heart, TrendingUp, Activity } from 'lucide-react';

export type TrendPeriod = number | 'all';

interface TrendChartsProps {
  period?: TrendPeriod;
  periodLabel?: string;
}

// Uniformly downsample for rendering only — never mutates source data.
function downsample<T>(data: T[], maxPoints = 150): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(data[Math.floor(i * step)]);
  }
  // ensure last point is preserved
  if (out[out.length - 1] !== data[data.length - 1]) {
    out.push(data[data.length - 1]);
  }
  return out;
}

export function TrendCharts({ period = 14, periodLabel = '14 dias' }: TrendChartsProps) {
  const { dailyChecks, workouts } = useData();
  const fullData = getTrendData(period, dailyChecks, workouts);
  const data = downsample(fullData, 150);

  const hasAnyData = fullData.some(d => d.hrv !== null || d.ctl > 0 || d.atl > 0);

  const EmptyState = () => (
    <div className="h-40 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
      Dados insuficientes para o período selecionado.
    </div>
  );

  // Calculate average baseline for reference line
  const baselineSamples = data.filter(d => d.hrvBaseline > 0);
  const avgBaseline = baselineSamples.length
    ? Math.round(baselineSamples.reduce((sum, d) => sum + d.hrvBaseline, 0) / baselineSamples.length)
    : 0;

  // Custom tooltip for HRV
  const HRVTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const hrv = payload[0]?.value;
      const baseline = payload[0]?.payload?.hrvBaseline;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">HRV: {hrv ?? '—'} ms</p>
          {baseline > 0 && (
            <p className="text-xs text-muted-foreground">Baseline: {baseline} ms</p>
          )}
        </div>
      );
    }
    return null;
  };

  const TSBTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const tsb = payload[0]?.value;
      const status = tsb >= 0 ? 'Form positivo' : tsb >= -15 ? 'Fadiga leve' : 'Alto risco';
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">TSB: {tsb}</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      );
    }
    return null;
  };

  const LoadTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const ctl = payload.find((p: any) => p.dataKey === 'ctl')?.value;
      const atl = payload.find((p: any) => p.dataKey === 'atl')?.value;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-primary">CTL: {ctl}</p>
          <p className="text-sm font-semibold text-status-alert">ATL: {atl}</p>
        </div>
      );
    }
    return null;
  };

  const tsbValues = data.map(d => d.tsb);
  const tsbMin = tsbValues.length ? Math.min(...tsbValues, -20) : -20;
  const tsbMax = tsbValues.length ? Math.max(...tsbValues, 10) : 10;

  const ctlAtlValues = [...data.map(d => d.ctl), ...data.map(d => d.atl)];
  const ctlAtlMin = ctlAtlValues.length ? Math.min(...ctlAtlValues, 0) : 0;
  const ctlAtlMax = ctlAtlValues.length ? Math.max(...ctlAtlValues, 50) : 50;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* HRV Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">HRV - {periodLabel}</span>
        </div>
        {!hasAnyData ? <EmptyState /> : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={{ stroke: 'hsl(222, 30%, 20%)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip content={<HRVTooltip />} />
                {avgBaseline > 0 && (
                  <ReferenceLine
                    y={avgBaseline}
                    stroke="hsl(215, 20%, 45%)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="hrv"
                  stroke="hsl(174, 72%, 56%)"
                  strokeWidth={2}
                  dot={data.length <= 60 ? { fill: 'hsl(174, 72%, 56%)', strokeWidth: 0, r: 3 } : false}
                  activeDot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasAnyData && avgBaseline > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Linha tracejada: baseline médio ({avgBaseline} ms)
          </p>
        )}
      </div>

      {/* CTL/ATL Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">CTL / ATL - {periodLabel}</span>
        </div>
        {!hasAnyData ? <EmptyState /> : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={{ stroke: 'hsl(222, 30%, 20%)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[Math.max(0, ctlAtlMin - 5), ctlAtlMax + 5]}
                />
                <Tooltip content={<LoadTooltip />} />
                <Line
                  type="monotone"
                  dataKey="ctl"
                  name="CTL"
                  stroke="hsl(174, 72%, 56%)"
                  strokeWidth={2}
                  dot={data.length <= 60 ? { fill: 'hsl(174, 72%, 56%)', strokeWidth: 0, r: 3 } : false}
                  activeDot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="atl"
                  name="ATL"
                  stroke="hsl(45, 93%, 47%)"
                  strokeWidth={2}
                  dot={data.length <= 60 ? { fill: 'hsl(45, 93%, 47%)', strokeWidth: 0, r: 3 } : false}
                  activeDot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasAnyData && (
          <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-primary rounded" /> CTL (Fitness)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-status-alert rounded" /> ATL (Fadiga)
            </span>
          </div>
        )}
      </div>

      {/* TSB Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">TSB (Form) - {periodLabel}</span>
        </div>
        {!hasAnyData ? <EmptyState /> : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tsbGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 45%)" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={{ stroke: 'hsl(222, 30%, 20%)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[tsbMin - 5, tsbMax + 5]}
                />
                <Tooltip content={<TSBTooltip />} />
                <ReferenceLine
                  y={0}
                  stroke="hsl(142, 76%, 45%)"
                  strokeWidth={1}
                  label={{ value: '0', position: 'right', fontSize: 10, fill: 'hsl(142, 76%, 45%)' }}
                />
                <ReferenceLine
                  y={-15}
                  stroke="hsl(0, 72%, 51%)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <Area
                  type="monotone"
                  dataKey="tsb"
                  stroke="hsl(174, 72%, 56%)"
                  strokeWidth={2}
                  fill="url(#tsbGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasAnyData && (
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-status-ok" /> &gt; 0
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-status-alert" /> -5 a -15
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-status-critical" /> &lt; -15
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
