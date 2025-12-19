import { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { getWeeklyHistory } from '@/lib/calculations';
import { useData } from '@/hooks/useData';
import { TrendingUp, TrendingDown, Minus, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function History() {
  const { dailyChecks, workouts, isLoading } = useData();
  const [weeksToShow, setWeeksToShow] = useState(8);
  
  if (isLoading) {
    return (
      <PageContainer title="Histórico" subtitle="Evolução semanal de carga">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }
  
  const history = getWeeklyHistory(weeksToShow, dailyChecks, workouts);
  
  const getTrendIcon = (current: number, previous: number | undefined) => {
    if (!previous) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (current > previous) return <TrendingUp className="w-4 h-4 text-status-ok" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-status-critical" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };
  
  const getTsbColor = (tsb: number) => {
    if (tsb < -15) return 'text-status-critical';
    if (tsb < 0) return 'text-status-alert';
    return 'text-status-ok';
  };
  
  return (
    <PageContainer 
      title="Histórico" 
      subtitle="Evolução semanal de carga"
    >
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4 animate-fade-in">
        {[4, 8, 12].map((weeks) => (
          <Button
            key={weeks}
            variant={weeksToShow === weeks ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setWeeksToShow(weeks)}
            className="flex items-center gap-2"
          >
            <Filter className="w-3 h-3" />
            {weeks} sem
          </Button>
        ))}
      </div>
      
      {/* History List */}
      <div className="space-y-3">
        {history.map((week, index) => {
          const previousWeek = history[index + 1];
          const isCurrentWeek = index === 0;
          
          return (
            <div 
              key={week.weekId}
              className={`gradient-card rounded-xl p-4 border animate-slide-up ${
                isCurrentWeek 
                  ? 'border-primary/50 shadow-glow' 
                  : 'border-border/50'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{week.weekId}</span>
                  {isCurrentWeek && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Atual
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  TSS: {week.weeklyTss}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs text-muted-foreground">CTL</span>
                    {getTrendIcon(week.ctl, previousWeek?.ctl)}
                  </div>
                  <span className="font-semibold">{week.ctl}</span>
                </div>
                
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs text-muted-foreground">ATL</span>
                    {getTrendIcon(week.atl, previousWeek?.atl)}
                  </div>
                  <span className="font-semibold">{week.atl}</span>
                </div>
                
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs text-muted-foreground">TSB</span>
                  </div>
                  <span className={`font-semibold ${getTsbColor(week.tsb)}`}>
                    {week.tsb > 0 ? '+' : ''}{week.tsb}
                  </span>
                </div>
              </div>
              
              {/* Progress bar for TSB visualization */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">-30</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full relative overflow-hidden">
                    {/* Zero line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30" />
                    {/* TSB indicator */}
                    <div 
                      className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ${
                        week.tsb >= 0 ? 'bg-status-ok' : week.tsb >= -15 ? 'bg-status-alert' : 'bg-status-critical'
                      }`}
                      style={{
                        left: week.tsb >= 0 ? '50%' : `${50 + (week.tsb / 30) * 50}%`,
                        width: `${Math.abs(week.tsb) / 30 * 50}%`,
                        maxWidth: '50%',
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">+30</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {history.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum dado histórico disponível.</p>
          <p className="text-sm mt-2">Comece registrando seu check-in diário!</p>
        </div>
      )}
    </PageContainer>
  );
}
