import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AICoach } from '@/components/AICoach';
import { TrendCharts } from '@/components/TrendCharts';
import { getTodayMetrics } from '@/lib/calculations';
import { TodayMetrics } from '@/types/health';
import { Heart, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, PauseCircle } from 'lucide-react';

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
  const [metrics, setMetrics] = useState<TodayMetrics | null>(null);
  
  useEffect(() => {
    setMetrics(getTodayMetrics());
  }, []);
  
  if (!metrics) {
    return (
      <PageContainer title="Hoje">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </PageContainer>
    );
  }
  
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
      
      {/* AI Coach Analysis */}
      <AICoach />
      
      {/* Trend Charts */}
      <TrendCharts />
      
      {/* Load Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="CTL"
          value={metrics.ctl}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="ATL"
          value={metrics.atl}
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label="TSB"
          value={metrics.tsb}
          valueClassName={
            metrics.tsb < -15 
              ? 'text-status-critical' 
              : metrics.tsb < 0 
                ? 'text-status-alert' 
                : 'text-status-ok'
          }
        />
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
