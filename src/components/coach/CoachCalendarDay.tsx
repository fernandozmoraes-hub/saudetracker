import { format, isToday, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TrainingPlan } from '@/hooks/useTrainingPlans';
import { CheckCircle2, XCircle, Clock, Dumbbell, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CoachCalendarDayProps {
  date: Date;
  plans: TrainingPlan[];
  workouts: any[];
}

const typeLabels: Record<string, string> = {
  endurance: 'Endurance',
  strength: 'Força',
  hiit: 'HIIT',
  recovery: 'Recuperação',
  Run: 'Corrida',
  Bike: 'Bike',
  Strength: 'Força',
  Rest: 'Descanso',
};

const typeColors: Record<string, string> = {
  endurance: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  strength: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  hiit: 'bg-red-500/10 text-red-400 border-red-500/20',
  recovery: 'bg-green-500/10 text-green-400 border-green-500/20',
  Run: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Bike: 'bg-green-500/10 text-green-400 border-green-500/20',
  Strength: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Rest: 'bg-muted text-muted-foreground border-border',
};

function getPlanStatus(plan: TrainingPlan, date: Date): 'completed' | 'skipped' | 'upcoming' | 'missed' {
  if (plan.status === 'completed') return 'completed';
  if (plan.status === 'skipped') return 'skipped';
  if (isFuture(date) || isToday(date)) return 'upcoming';
  return 'missed';
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Concluído', bg: 'bg-green-500/10 border-green-500/30' },
  skipped:   { icon: XCircle,      color: 'text-red-500',   label: 'Pulado',    bg: 'bg-red-500/10 border-red-500/30' },
  upcoming:  { icon: Clock,        color: 'text-blue-400',  label: 'Planejado', bg: 'bg-blue-500/10 border-blue-500/30' },
  missed:    { icon: AlertCircle,  color: 'text-orange-500',label: 'Não feito', bg: 'bg-orange-500/10 border-orange-500/30' },
};

export function CoachCalendarDay({ date, plans, workouts }: CoachCalendarDayProps) {
  const isCurrentDay = isToday(date);
  const dayName = format(date, 'EEE', { locale: ptBR });
  const dayNumber = format(date, 'd');
  const monthName = format(date, 'MMM', { locale: ptBR });

  const plannedTSS = plans.reduce((s, p) => s + (Number(p.planned_tss) || 0), 0);
  const actualTSS = workouts.reduce((s, w) => s + (Number(w.tss_final) || Number(w.tss_subjective) || 0), 0);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 space-y-3 transition-all',
        isCurrentDay && 'ring-2 ring-primary border-primary bg-primary/5',
      )}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex flex-col items-center justify-center text-center',
              isCurrentDay ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <span className="text-lg font-bold leading-none">{dayNumber}</span>
            <span className="text-[10px] uppercase">{monthName}</span>
          </div>
          <div>
            <p className={cn('font-medium capitalize', isCurrentDay ? 'text-primary' : 'text-foreground')}>
              {dayName}
            </p>
            {isCurrentDay && <span className="text-xs text-primary font-medium">Hoje</span>}
          </div>
        </div>

        {/* TSS comparison */}
        {(plannedTSS > 0 || actualTSS > 0) && (
          <div className="text-right text-xs space-y-0.5">
            {plannedTSS > 0 && (
              <p className="text-muted-foreground">
                Plan: <span className="font-semibold text-foreground">{Math.round(plannedTSS)}</span>
              </p>
            )}
            {actualTSS > 0 && (
              <p className="text-muted-foreground">
                Real: <span className="font-semibold text-green-400">{Math.round(actualTSS)}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Plans */}
      {plans.map((plan) => {
        const status = getPlanStatus(plan, date);
        const cfg = statusConfig[status];
        const Icon = cfg.icon;
        const colorClass = typeColors[plan.type] ?? typeColors.endurance;

        return (
          <div
            key={plan.id}
            className={cn('rounded-lg border p-3 space-y-1.5', cfg.bg)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Dumbbell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', colorClass)}>
                  {typeLabels[plan.type] ?? plan.type}
                </span>
              </div>
              <div className={cn('flex items-center gap-1 text-xs font-medium shrink-0', cfg.color)}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground pl-5">
              {plan.planned_duration_min && <span>{plan.planned_duration_min}min</span>}
              {plan.planned_zone && <span>Z{plan.planned_zone}</span>}
              {plan.planned_tss && <span>TSS {plan.planned_tss}</span>}
              {plan.notes && <span className="italic truncate max-w-[180px]">"{plan.notes}"</span>}
            </div>
          </div>
        );
      })}

      {/* Actual workouts */}
      {workouts.map((w: any) => {
        const isPlanned = plans.some((p) => p.status === 'completed' && p.workout_id === w.id);
        const colorClass = typeColors[w.type] ?? typeColors.Run;

        return (
          <div
            key={w.id}
            className={cn(
              'rounded-lg border p-3 space-y-1.5',
              isPlanned ? 'opacity-60' : 'bg-green-500/5 border-green-500/20',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', colorClass)}>
                  {typeLabels[w.type] ?? w.type}
                </span>
                {!isPlanned && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">Extra</Badge>
                )}
              </div>
              <span className="text-xs font-semibold text-green-400 shrink-0">
                TSS {Math.round(Number(w.tss_final) || Number(w.tss_subjective) || 0)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground pl-5">
              {w.duration_min && <span>{w.duration_min}min</span>}
              {w.rpe && <span>RPE {w.rpe}</span>}
              {w.distance_km && <span>{Number(w.distance_km).toFixed(1)} km</span>}
            </div>
          </div>
        );
      })}

      {/* Empty day */}
      {plans.length === 0 && workouts.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">Descanso</p>
      )}
    </div>
  );
}
