import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, TrendingUp, Heart, Moon, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { label: '2 sem', days: 14 },
  { label: '4 sem', days: 28 },
  { label: '8 sem', days: 56 },
];

function StatDiff({ current, previous, unit = '' }: { current: number | null; previous: number | null; unit?: string }) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="text-xs text-muted-foreground">= {unit}</span>;
  const positive = diff > 0;
  return (
    <span className={cn('text-xs font-medium', positive ? 'text-green-400' : 'text-red-400')}>
      {positive ? '+' : ''}{Math.round(diff)}{unit} vs sem. anterior
    </span>
  );
}

export default function CoachAthleteTrends() {
  const { id: athleteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState(28);
  const [athleteName, setAthleteName] = useState('');
  const [dailyChecks, setDailyChecks] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !athleteId) return;
    const from = format(subDays(new Date(), period), 'yyyy-MM-dd');

    setIsLoading(true);
    Promise.all([
      supabase.from('profiles').select('display_name, email').eq('user_id', athleteId).maybeSingle(),
      supabase.from('daily_checks').select('date, hrv, sleep_hours, resting_hr').eq('user_id', athleteId).gte('date', from).order('date'),
      supabase.from('workouts').select('date, tss_final, tss_subjective, duration_min').eq('user_id', athleteId).gte('date', from).order('date'),
    ]).then(([profileRes, checksRes, workoutsRes]) => {
      if (checksRes.error || workoutsRes.error) toast.error('Erro ao carregar dados.');
      const p = profileRes.data as any;
      setAthleteName(p?.display_name ?? p?.email ?? '');
      setDailyChecks(checksRes.data || []);
      setWorkouts(workoutsRes.data || []);
      setIsLoading(false);
    });
  }, [user, athleteId, period]);

  // Build daily chart data (merge checks + workouts by date)
  const chartData = (() => {
    const map = new Map<string, any>();
    for (const c of dailyChecks) {
      map.set(c.date, { date: c.date, hrv: c.hrv ?? null, sleep: c.sleep_hours ? Number(c.sleep_hours) : null, tss: 0 });
    }
    for (const w of workouts) {
      const tss = Number(w.tss_final) || Number(w.tss_subjective) || 0;
      const existing = map.get(w.date);
      if (existing) existing.tss = (existing.tss || 0) + tss;
      else map.set(w.date, { date: w.date, hrv: null, sleep: null, tss });
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      ...d,
      label: format(new Date(d.date + 'T12:00:00'), 'd/M'),
    }));
  })();

  // Weekly TSS comparison
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const thisWeekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const lastWeekStart = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const lastWeekEnd = format(endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const weekTSS = (from: string, to: string) =>
    workouts.filter((w) => w.date >= from && w.date <= to)
      .reduce((s, w) => s + (Number(w.tss_final) || Number(w.tss_subjective) || 0), 0);

  const avgHRV = (from: string, to: string) => {
    const vals = dailyChecks.filter((c) => c.date >= from && c.date <= to && c.hrv).map((c) => Number(c.hrv));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgSleep = (from: string, to: string) => {
    const vals = dailyChecks.filter((c) => c.date >= from && c.date <= to && c.sleep_hours).map((c) => Number(c.sleep_hours));
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  };

  const thisWeekTSS = weekTSS(thisWeekStart, thisWeekEnd);
  const lastWeekTSS = weekTSS(lastWeekStart, lastWeekEnd);
  const thisWeekHRV = avgHRV(thisWeekStart, thisWeekEnd);
  const lastWeekHRV = avgHRV(lastWeekStart, lastWeekEnd);
  const thisWeekSleep = avgSleep(thisWeekStart, thisWeekEnd);
  const lastWeekSleep = avgSleep(lastWeekStart, lastWeekEnd);

  return (
    <PageContainer title="Tendências" subtitle={athleteName || 'Atleta'}>
      <div className="space-y-4 pb-20">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/coach/athlete/${athleteId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <Button
              key={days}
              size="sm"
              variant={period === days ? 'default' : 'secondary'}
              onClick={() => setPeriod(days)}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Semana atual vs anterior */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Semana Atual vs Anterior
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3" /> TSS
                  </p>
                  <p className="text-xl font-bold text-foreground">{Math.round(thisWeekTSS)}</p>
                  <StatDiff current={thisWeekTSS} previous={lastWeekTSS} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" /> HRV médio
                  </p>
                  <p className="text-xl font-bold text-foreground">{thisWeekHRV ?? '—'}</p>
                  <StatDiff current={thisWeekHRV} previous={lastWeekHRV} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" /> Sono médio
                  </p>
                  <p className="text-xl font-bold text-foreground">{thisWeekSleep ? `${thisWeekSleep}h` : '—'}</p>
                  <StatDiff current={thisWeekSleep} previous={lastWeekSleep} unit="h" />
                </div>
              </CardContent>
            </Card>

            {/* TSS por dia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> TSS Diário
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.some((d) => d.tss > 0) ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="tss" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem treinos registrados no período.</p>
                )}
              </CardContent>
            </Card>

            {/* HRV */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" /> HRV
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.some((d) => d.hrv) ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      {thisWeekHRV && <ReferenceLine y={thisWeekHRV} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />}
                      <Line type="monotone" dataKey="hrv" stroke="#f87171" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem dados de HRV no período.</p>
                )}
              </CardContent>
            </Card>

            {/* Sono */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Moon className="w-4 h-4 text-blue-400" /> Sono (horas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.some((d) => d.sleep) ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis domain={[4, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <ReferenceLine y={7} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" label={{ value: '7h', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Line type="monotone" dataKey="sleep" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem dados de sono no período.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
