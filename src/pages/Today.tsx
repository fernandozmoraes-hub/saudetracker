import { useMemo, useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadStatusCard } from '@/components/ui/LoadStatusCard';
import { AICoach } from '@/components/AICoach';
import { TrendCharts, TrendPeriod } from '@/components/TrendCharts';
import { Button } from '@/components/ui/button';
import { getTodayMetrics } from '@/lib/calculations';
import { formatMetric } from '@/lib/formatMetric';
import { useData } from '@/hooks/useData';
import { useAlcoholIntake } from '@/hooks/useAlcoholIntake';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { PlannedWorkoutCard } from '@/components/calendar/PlannedWorkoutCard';
import { getAlcoholHRVCorrelation, getCorrelationColor, getCorrelationBgColor, getWeeklyPattern, getWeeklyPatternColor, getTrendArrow } from '@/lib/alcoholCalcs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, PauseCircle, Loader2, Dumbbell, Wine, Brain, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type PeriodKey = '14D' | '30D' | '90D' | '180D' | '1A' | 'Tudo';
const PERIOD_OPTIONS: { key: PeriodKey; days: TrendPeriod; label: string }[] = [
  { key: '14D', days: 14, label: '14 dias' },
  { key: '30D', days: 30, label: '30 dias' },
  { key: '90D', days: 90, label: '90 dias' },
  { key: '180D', days: 180, label: '180 dias' },
  { key: '1A', days: 365, label: '1 ano' },
  { key: 'Tudo', days: 'all', label: 'Tudo' },
];
const STORAGE_KEY = 'dashboard_period_filter';


const recommendationConfig = {
  maintain: {
    icon: <CheckCircle className="w-6 h-6" />,
    label: 'Manter Carga',
    description: 'Seu corpo está respondendo bem. Continue com o plano.',
    color: 'text-status-ok',
    bg: 'bg-status-ok/10 border-status-ok/30',
  },
  reduce: {
    icon: <TrendingDown className="w-6 h-6" />,
    label: 'Reduzir Carga',
    description: 'Sinais de fadiga. Reduza intensidade ou volume hoje.',
    color: 'text-status-alert',
    bg: 'bg-status-alert/10 border-status-alert/30',
  },
  rest: {
    icon: <PauseCircle className="w-6 h-6" />,
    label: 'Descansar',
    description: 'Priorize recuperação. Considere um dia off ou ativo leve.',
    color: 'text-status-critical',
    bg: 'bg-status-critical/10 border-status-critical/30',
  },
};

export default function Today() {
  const { dailyChecks, workouts, isLoading } = useData();
  const { entries: alcoholEntries } = useAlcoholIntake();
  const { plans } = useTrainingPlans();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayPlans = plans.filter(p => p.date === todayStr);

  const correlation = useMemo(
    () => getAlcoholHRVCorrelation(alcoholEntries, dailyChecks.map(c => ({ date: c.date, hrv: c.hrv }))),
    [alcoholEntries, dailyChecks]
  );
  const weeklyPattern = useMemo(() => getWeeklyPattern(alcoholEntries), [alcoholEntries]);

  const [period, setPeriod] = useState<PeriodKey>(() => {
    if (typeof window === 'undefined') return '14D';
    const stored = window.localStorage.getItem(STORAGE_KEY) as PeriodKey | null;
    return stored && PERIOD_OPTIONS.some(p => p.key === stored) ? stored : '14D';
  });
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, period); } catch { /* ignore */ }
  }, [period]);
  const activePeriod = PERIOD_OPTIONS.find(p => p.key === period) ?? PERIOD_OPTIONS[0];

  
  if (isLoading) {
    return (
      <PageContainer title="Hoje">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }
  
  const metrics = getTodayMetrics(dailyChecks, workouts);
  const recommendation = recommendationConfig[metrics.recommendation];
  
  return (
    <PageContainer 
      title="Hoje" 
      subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
    >
      {/* HRV Status Card */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-primary" />
            <span className="font-display font-semibold text-lg">HRV</span>
          </div>
          <StatusBadge status={metrics.hrvStatus} size="lg" showLabel />
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-display font-bold">
              {metrics.hrv || '—'}
              <span className="text-lg text-muted-foreground ml-1">ms</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Baseline 7d</p>
            <p className="text-xl font-semibold">{metrics.hrvBaseline || '—'} ms</p>
          </div>
        </div>
        
        {metrics.hrvBaseline > 0 && metrics.hrv > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div 
                className="h-2 rounded-full bg-primary/20 flex-1"
                style={{ overflow: 'hidden' }}
              >
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ 
                    width: `${Math.min((metrics.hrv / metrics.hrvBaseline) * 100, 100)}%` 
                  }}
                />
              </div>
              <span className="text-sm font-medium">
                {Math.round((metrics.hrv / metrics.hrvBaseline) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Alert */}
      {metrics.alert && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-critical/10 border border-status-critical/30 animate-slide-up">
          <AlertTriangle className="w-5 h-5 text-status-critical flex-shrink-0" />
          <p className="text-sm font-medium text-status-critical">{metrics.alert}</p>
        </div>
      )}
      
      {/* Recommendation */}
      <div className={`rounded-xl p-5 border animate-slide-up ${recommendation.bg}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={recommendation.color}>{recommendation.icon}</span>
          <h3 className={`font-display font-semibold text-lg ${recommendation.color}`}>
            {recommendation.label}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{recommendation.description}</p>
      </div>
      
      {/* Prescribed workout for today */}
      {todayPlans.length > 0 && (
        <div className="space-y-2 animate-slide-up">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Treino prescrito para hoje</h3>
          </div>
          {todayPlans.map((plan) => (
            <PlannedWorkoutCard key={plan.id} plan={plan} date={new Date()} />
          ))}
        </div>
      )}

      {/* AI Coach Analysis */}
      <AICoach />

      {/* Performance Coach access */}
      <Link
        to="/performance-coach"
        className="flex items-center justify-between gradient-card rounded-xl p-5 border border-border/50 animate-slide-up hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-semibold">Performance Coach</p>
            <p className="text-xs text-muted-foreground">Análise integrada de todos os seus dados</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-primary font-medium">
          Abrir
          <ChevronRight className="w-4 h-4" />
        </div>
      </Link>
      
      {/* Alcohol Impact Card - only if sufficient data */}
      {correlation && (
        <div className={`rounded-xl p-5 border border-border/50 animate-slide-up ${getCorrelationBgColor(correlation.classification)}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wine className="w-5 h-5 text-primary" />
              <span className="font-display font-semibold">Impacto do Álcool</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getWeeklyPatternColor(weeklyPattern.pattern) === 'text-green-500' ? 'bg-green-500/10 text-green-500' : getWeeklyPatternColor(weeklyPattern.pattern) === 'text-yellow-500' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
              {weeklyPattern.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Correlação (r)</p>
              <p className={`text-lg font-bold ${getCorrelationColor(correlation.classification)}`}>
                {correlation.r.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Média semanal</p>
              <p className="text-lg font-bold">{weeklyPattern.avgWeekly}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tendência</p>
              <p className="text-lg font-bold">{getTrendArrow(weeklyPattern.trend)}</p>
            </div>
          </div>
          <p className={`text-xs mt-2 ${getCorrelationColor(correlation.classification)}`}>
            {correlation.label}
          </p>
        </div>
      )}

      {/* Trend Charts */}
      {/* Period selector for charts */}
      <div className="flex flex-wrap gap-2 animate-fade-in">
        {PERIOD_OPTIONS.map(opt => (
          <Button
            key={opt.key}
            variant={period === opt.key ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setPeriod(opt.key)}
          >
            {opt.key}
          </Button>
        ))}
      </div>

      <TrendCharts period={activePeriod.days} periodLabel={activePeriod.label} />
      
      {/* Load Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="CTL"
          value={formatMetric(metrics.ctl)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="ATL"
          value={formatMetric(metrics.atl)}
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label="TSB"
          value={formatMetric(metrics.tsb)}
          valueClassName={
            metrics.tsb < -15 
              ? 'text-status-critical' 
              : metrics.tsb < 0 
                ? 'text-status-alert' 
                : 'text-status-ok'
          }
        />
        <LoadStatusCard tsb={metrics.tsb} />
      </div>
      
      {/* Active Model Banner */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/70 border border-border/40 animate-slide-up">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Modelo de carga ativo</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" /> Endurance via FC
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="w-3 h-3" /> Força via RPE
          </span>
        </div>
      </div>
      
      {/* Quick explanation */}
      <div className="text-xs text-muted-foreground space-y-1 p-4 rounded-lg bg-secondary/50">
        <p><strong>CTL</strong> = Fitness (carga crônica 42d)</p>
        <p><strong>ATL</strong> = Fadiga (carga aguda 7d)</p>
        <p><strong>TSB</strong> = Form (CTL - ATL). Negativo = cansado</p>
      </div>
    </PageContainer>
  );
}
