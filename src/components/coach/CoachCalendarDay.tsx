import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrainingPlan } from '@/hooks/useTrainingPlans';
import { cn } from '@/lib/utils';

interface Workout {
  id: string;
  date: string;
  type: string;
  duration_min: number;
  rpe: number;
  tss_final: number | null;
  tss_subjective: number;
}

interface CoachCalendarDayProps {
  date: Date;
  plans: TrainingPlan[];
  workouts: Workout[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  completed: { label: 'Concluído', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  planned: { label: 'Planejado', variant: 'secondary', className: 'bg-blue-500 hover:bg-blue-500 text-white' },
  skipped: { label: 'Pulado', variant: 'destructive' },
};

export function CoachCalendarDay({ date, plans, workouts }: CoachCalendarDayProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayPlans = plans.filter(p => p.date === dateStr);
  const dayWorkouts = workouts.filter(w => w.date === dateStr);

  // Find "extra" workouts (no matching plan)
  const plannedWorkoutIds = new Set(dayPlans.map(p => p.workout_id).filter(Boolean));
  const extraWorkouts = dayWorkouts.filter(w => !plannedWorkoutIds.has(w.id));

  // Check unfinished plans
  const unfinishedPlans = dayPlans.filter(p => p.status === 'planned' && new Date(dateStr) < new Date(format(new Date(), 'yyyy-MM-dd')));

  const today = isToday(date);

  return (
    <Card className={cn(
      'p-3 space-y-2 min-h-[120px]',
      today && 'ring-2 ring-primary'
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          'text-xs font-semibold uppercase',
          today ? 'text-primary' : 'text-muted-foreground'
        )}>
          {format(date, 'EEE', { locale: ptBR })}
        </span>
        <span className={cn(
          'text-sm font-bold',
          today ? 'text-primary' : 'text-foreground'
        )}>
          {format(date, 'dd')}
        </span>
      </div>

      {/* Planned workouts */}
      {dayPlans.map(plan => {
        const config = statusConfig[plan.status] || statusConfig.planned;
        const isUnfinished = plan.status === 'planned' && new Date(dateStr) < new Date(format(new Date(), 'yyyy-MM-dd'));

        return (
          <div key={plan.id} className="rounded-md bg-muted/50 p-2 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-foreground truncate">{plan.type}</span>
              <Badge
                variant={isUnfinished ? 'destructive' : config.variant}
                className={cn('text-[10px] px-1.5 py-0', !isUnfinished && config.className)}
              >
                {isUnfinished ? 'Não feito' : config.label}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {plan.planned_duration_min}min
              {plan.planned_zone ? ` • Z${plan.planned_zone}` : ''}
              {plan.planned_tss ? ` • TSS ${plan.planned_tss}` : ''}
            </p>
            {plan.notes && (
              <p className="text-[10px] text-muted-foreground italic truncate">{plan.notes}</p>
            )}
          </div>
        );
      })}

      {/* Realized workouts linked to plans */}
      {dayWorkouts.filter(w => plannedWorkoutIds.has(w.id)).map(w => (
        <div key={`real-${w.id}`} className="rounded-md bg-emerald-500/10 p-2">
          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            Realizado: {w.duration_min}min • RPE {w.rpe} • TSS {Number(w.tss_final || w.tss_subjective)}
          </p>
        </div>
      ))}

      {/* Extra workouts */}
      {extraWorkouts.map(w => (
        <div key={`extra-${w.id}`} className="rounded-md bg-amber-500/10 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">{w.type}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">
              Extra
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {w.duration_min}min • RPE {w.rpe} • TSS {Number(w.tss_final || w.tss_subjective)}
          </p>
        </div>
      ))}

      {dayPlans.length === 0 && dayWorkouts.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center pt-4">Descanso</p>
      )}
    </Card>
  );
}
