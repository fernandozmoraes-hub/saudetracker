import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricCard } from '@/components/ui/MetricCard';
import { getWeeklyLoad } from '@/lib/calculations';
import { useData } from '@/hooks/useData';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, Loader2 } from 'lucide-react';

export default function Week() {
  const { dailyChecks, workouts, isLoading } = useData();
  
  if (isLoading) {
    return (
      <PageContainer title="Semana">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }
  
  const currentWeek = getWeeklyLoad(0, workouts);
  const lastWeek = getWeeklyLoad(1, workouts);
  
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    if (!previous) return 'stable';
    const diff = ((current - previous) / previous) * 100;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  };
  
  const ctlTrend = getTrend(currentWeek.ctl, lastWeek.ctl);
  const atlTrend = getTrend(currentWeek.atl, lastWeek.atl);
  
  const isOverreaching = currentWeek.tsb < -15 || currentWeek.atl > currentWeek.ctl * 1.3;
  
  return (
    <PageContainer 
      title="Semana" 
      subtitle={`${format(weekStart, "d MMM", { locale: ptBR })} - ${format(weekEnd, "d MMM", { locale: ptBR })}`}
    >
      {/* Week ID */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary border border-border animate-slide-up">
        <Calendar className="w-5 h-5 text-primary" />
        <div>
          <p className="font-display font-semibold">{currentWeek.weekId}</p>
          <p className="text-sm text-muted-foreground">Semana atual</p>
        </div>
      </div>
      
      {/* Overreaching Alert */}
      {isOverreaching && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-critical/10 border border-status-critical/30 animate-slide-up">
          <AlertTriangle className="w-5 h-5 text-status-critical flex-shrink-0" />
          <div>
            <p className="font-medium text-status-critical">Risco de Overreaching</p>
            <p className="text-sm text-muted-foreground">
              Carga aguda muito alta em relação à crônica. Considere reduzir.
            </p>
          </div>
        </div>
      )}
      
      {/* Weekly TSS */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 animate-slide-up">
        <p className="text-sm text-muted-foreground mb-2">TSS Semanal</p>
        <div className="flex items-end justify-between">
          <p className="text-4xl font-display font-bold text-primary">
            {currentWeek.weeklyTss}
          </p>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Semana anterior</p>
            <p className="text-lg font-semibold">{lastWeek.weeklyTss}</p>
          </div>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="CTL"
          value={currentWeek.ctl}
          trend={ctlTrend}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="ATL"
          value={currentWeek.atl}
          trend={atlTrend}
          icon={
            atlTrend === 'up' 
              ? <TrendingUp className="w-4 h-4" /> 
              : atlTrend === 'down' 
                ? <TrendingDown className="w-4 h-4" /> 
                : <Minus className="w-4 h-4" />
          }
        />
        <MetricCard
          label="TSB"
          value={currentWeek.tsb}
          valueClassName={
            currentWeek.tsb < -15 
              ? 'text-status-critical' 
              : currentWeek.tsb < 0 
                ? 'text-status-alert' 
                : 'text-status-ok'
          }
        />
      </div>
      
      {/* Comparison with last week */}
      <div className="space-y-3 animate-slide-up">
        <h3 className="font-display font-semibold">Comparação Semanal</h3>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-secondary">
            <p className="text-xs text-muted-foreground mb-1">CTL</p>
            <p className={`font-semibold ${
              currentWeek.ctl > lastWeek.ctl ? 'text-status-ok' : 'text-status-alert'
            }`}>
              {currentWeek.ctl > lastWeek.ctl ? '+' : ''}
              {currentWeek.ctl - lastWeek.ctl}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-secondary">
            <p className="text-xs text-muted-foreground mb-1">ATL</p>
            <p className={`font-semibold ${
              currentWeek.atl < lastWeek.atl ? 'text-status-ok' : 'text-status-alert'
            }`}>
              {currentWeek.atl > lastWeek.atl ? '+' : ''}
              {currentWeek.atl - lastWeek.atl}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-secondary">
            <p className="text-xs text-muted-foreground mb-1">TSB</p>
            <p className={`font-semibold ${
              currentWeek.tsb > lastWeek.tsb ? 'text-status-ok' : 'text-status-alert'
            }`}>
              {currentWeek.tsb > lastWeek.tsb ? '+' : ''}
              {currentWeek.tsb - lastWeek.tsb}
            </p>
          </div>
        </div>
      </div>
      
      {/* Guide */}
      <div className="text-xs text-muted-foreground space-y-1 p-4 rounded-lg bg-secondary/50">
        <p>↑ <strong>CTL subindo</strong> = construindo fitness</p>
        <p>↑ <strong>ATL subindo</strong> = acumulando fadiga</p>
        <p>↓ <strong>TSB negativo</strong> = corpo cansado</p>
      </div>
    </PageContainer>
  );
}
