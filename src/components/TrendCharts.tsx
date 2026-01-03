import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { get14DayTrend, DailyTrendData } from '@/lib/calculations';
import { useData } from '@/hooks/useData';
import { Heart, TrendingUp, Activity } from 'lucide-react';

export function TrendCharts() {
  const { dailyChecks, workouts } = useData();
  const data = get14DayTrend(dailyChecks, workouts);
  
  if (data.length === 0) {
    return null;
  }
  
  // Calculate average baseline for reference line
  const avgBaseline = Math.round(
    data.filter(d => d.hrvBaseline > 0).reduce((sum, d) => sum + d.hrvBaseline, 0) / 
    Math.max(data.filter(d => d.hrvBaseline > 0).length, 1)
  );
  
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
  
  // Custom tooltip for TSB
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
  
  // Custom tooltip for CTL/ATL
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
  
  // Find min/max for TSB chart
  const tsbValues = data.map(d => d.tsb);
  const tsbMin = Math.min(...tsbValues, -20);
  const tsbMax = Math.max(...tsbValues, 10);
  
  // Find min/max for CTL/ATL chart
  const ctlAtlValues = [...data.map(d => d.ctl), ...data.map(d => d.atl)];
  const ctlAtlMin = Math.min(...ctlAtlValues, 0);
  const ctlAtlMax = Math.max(...ctlAtlValues, 50);
  
  return (
    <div className="space-y-4 animate-slide-up">
      {/* HRV Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">HRV - 14 dias</span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                axisLine={{ stroke: 'hsl(222, 30%, 20%)' }}
                tickLine={false}
                interval="preserveStartEnd"
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
                dot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {avgBaseline > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Linha tracejada: baseline médio ({avgBaseline} ms)
          </p>
        )}
      </div>
      
      {/* CTL/ATL Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">CTL / ATL - 14 dias</span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
                axisLine={{ stroke: 'hsl(222, 30%, 20%)' }}
                tickLine={false}
                interval="preserveStartEnd"
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
                dot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: 'hsl(174, 72%, 56%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="atl" 
                name="ATL"
                stroke="hsl(45, 93%, 47%)" 
                strokeWidth={2}
                dot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 2, stroke: 'hsl(222, 47%, 11%)', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-primary rounded" /> CTL (Fitness)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-status-alert rounded" /> ATL (Fadiga)
          </span>
        </div>
      </div>
      
      {/* TSB Trend Chart */}
      <div className="gradient-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">TSB (Form) - 14 dias</span>
        </div>
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
      </div>
    </div>
  );
}
