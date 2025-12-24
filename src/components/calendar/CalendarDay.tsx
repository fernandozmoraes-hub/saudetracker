import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DailyCheck, Workout } from '@/types/health';
import { DayMetricsCard } from './DayMetricsCard';
import { DayWorkoutCard } from './DayWorkoutCard';

interface CalendarDayProps {
  date: Date;
  dailyCheck?: DailyCheck;
  workouts: Workout[];
}

export function CalendarDay({ date, dailyCheck, workouts }: CalendarDayProps) {
  const isCurrentDay = isToday(date);
  const dayName = format(date, 'EEEE', { locale: ptBR });
  const dayNumber = format(date, 'd');
  const monthName = format(date, 'MMM', { locale: ptBR });

  const totalTss = workouts.reduce((sum, w) => sum + (w.tssFinal ?? w.tssSubjective), 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3 transition-all",
        isCurrentDay && "ring-2 ring-primary border-primary bg-primary/5"
      )}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex flex-col items-center justify-center text-center",
              isCurrentDay 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className="text-lg font-bold leading-none">{dayNumber}</span>
            <span className="text-[10px] uppercase">{monthName}</span>
          </div>
          <div>
            <div className={cn(
              "font-medium capitalize",
              isCurrentDay ? "text-primary" : "text-foreground"
            )}>
              {dayName}
            </div>
            {isCurrentDay && (
              <span className="text-xs text-primary font-medium">Hoje</span>
            )}
          </div>
        </div>

        {/* Total TSS Badge */}
        {totalTss > 0 && (
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">{Math.round(totalTss)}</div>
            <div className="text-xs text-muted-foreground">TSS</div>
          </div>
        )}
      </div>

      {/* Daily Check Metrics */}
      {dailyCheck && <DayMetricsCard dailyCheck={dailyCheck} />}

      {/* Workouts */}
      {workouts.length > 0 && (
        <div className="space-y-2">
          {workouts.map((workout) => (
            <DayWorkoutCard key={workout.id} workout={workout} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!dailyCheck && workouts.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Sem registros
        </div>
      )}
    </div>
  );
}
