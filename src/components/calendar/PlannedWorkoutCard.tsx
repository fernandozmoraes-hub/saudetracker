import { isToday, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { TrainingPlan } from '@/hooks/useTrainingPlans';
import { CheckCircle2, XCircle, Clock, AlertCircle, ClipboardList } from 'lucide-react';

interface PlannedWorkoutCardProps {
  plan: TrainingPlan;
  date: Date;
}

const typeLabels: Record<string, string> = {
  endurance: 'Endurance',
  strength: 'Força',
  hiit: 'HIIT',
  recovery: 'Recuperação',
};

const typeColors: Record<string, string> = {
  endurance: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  strength: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  hiit: 'bg-red-500/10 text-red-400 border-red-500/20',
  recovery: 'bg-green-500/10 text-green-400 border-green-500/20',
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

export function PlannedWorkoutCard({ plan, date }: PlannedWorkoutCardProps) {
  const status = getPlanStatus(plan, date);
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  const colorClass = typeColors[plan.type] ?? typeColors.endurance;

  return (
    <div className={cn('rounded-lg border p-3 space-y-1.5', cfg.bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
        {plan.planned_zone && <span>Zona {plan.planned_zone}</span>}
        {plan.planned_tss && <span>TSS {plan.planned_tss}</span>}
      </div>
      {plan.notes && (
        <p className="text-xs text-muted-foreground pl-5 whitespace-pre-line">{plan.notes}</p>
      )}
    </div>
  );
}
