import { Workout } from '@/types/health';
import { format, eachDayOfInterval } from 'date-fns';
import { getDailyTssEffective, calculateATL, calculateCTL } from '@/lib/calculations';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMetric } from '@/lib/formatMetric';

interface WeeklySummaryProps {
  weekStart: Date;
  weekEnd: Date;
  workouts: Workout[];
}

export function WeeklySummary({ weekStart, weekEnd, workouts }: WeeklySummaryProps) {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  // Calculate weekly totals
  const weeklyStats = days.reduce((acc, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayWorkouts = workouts.filter(w => w.date === dateStr);
    
    dayWorkouts.forEach(workout => {
      acc.totalTss += workout.tssFinal ?? workout.tssSubjective;
      acc.totalDuration += workout.durationMin;
      acc.totalDistance += workout.distanceKm || 0;
      acc.workoutCount += 1;
      
      // Count by type
      if (!acc.byType[workout.type]) {
        acc.byType[workout.type] = 0;
      }
      acc.byType[workout.type] += 1;
    });
    
    return acc;
  }, {
    totalTss: 0,
    totalDuration: 0,
    totalDistance: 0,
    workoutCount: 0,
    byType: {} as Record<string, number>,
  });

  // Calculate performance metrics at end of week
  const lastDay = format(weekEnd, 'yyyy-MM-dd');
  const ctl = calculateCTL(lastDay, workouts);
  const atl = calculateATL(lastDay, workouts);
  const tsb = ctl - atl;

  const totalMinutes = Math.round(weeklyStats.totalDuration);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const getTsbStatus = (value: number) => {
    if (value > 10) return { label: 'Fresh', color: 'text-green-500' };
    if (value > -10) return { label: 'Optimal', color: 'text-blue-500' };
    if (value > -20) return { label: 'Tired', color: 'text-yellow-500' };
    return { label: 'Fatigued', color: 'text-red-500' };
  };

  const tsbStatus = getTsbStatus(tsb);

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Resumo da Semana</h3>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">CTL</div>
          <div className="text-xl font-bold text-foreground">{formatMetric(ctl)}</div>
          <div className="text-[10px] text-muted-foreground">Fitness</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">ATL</div>
          <div className="text-xl font-bold text-foreground">{formatMetric(atl)}</div>
          <div className="text-[10px] text-muted-foreground">Fatigue</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">TSB</div>
          <div className={cn("text-xl font-bold flex items-center justify-center gap-1", tsbStatus.color)}>
            {tsb > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatMetric(tsb)}
          </div>
          <div className="text-[10px] text-muted-foreground">{tsbStatus.label}</div>
        </div>
      </div>

      {/* Weekly Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {Math.round(weeklyStats.totalTss)}
            </div>
            <div className="text-xs text-muted-foreground">TSS Total</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {hours}:{String(minutes).padStart(2, '0')}
            </div>
            <div className="text-xs text-muted-foreground">Duração</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <span className="text-xs font-bold text-green-500">km</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {weeklyStats.totalDistance.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Distância</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-500">#</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {weeklyStats.workoutCount}
            </div>
            <div className="text-xs text-muted-foreground">Treinos</div>
          </div>
        </div>
      </div>

      {/* Workout Types Breakdown */}
      {Object.keys(weeklyStats.byType).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {Object.entries(weeklyStats.byType).map(([type, count]) => (
            <span
              key={type}
              className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground"
            >
              {type}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
