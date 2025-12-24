import { Workout } from '@/types/health';
import { cn } from '@/lib/utils';
import { Footprints, Dumbbell, Bike, Bed } from 'lucide-react';

interface DayWorkoutCardProps {
  workout: Workout;
}

const workoutIcons = {
  Run: Footprints,
  Strength: Dumbbell,
  Bike: Bike,
  Rest: Bed,
};

const workoutColors = {
  Run: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Strength: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Bike: 'bg-green-500/10 text-green-500 border-green-500/20',
  Rest: 'bg-muted text-muted-foreground border-border',
};

export function DayWorkoutCard({ workout }: DayWorkoutCardProps) {
  const Icon = workoutIcons[workout.type] || Footprints;
  const colorClass = workoutColors[workout.type] || workoutColors.Run;

  const hours = Math.floor(workout.durationMin / 60);
  const minutes = workout.durationMin % 60;
  const durationFormatted = hours > 0 
    ? `${hours}:${String(minutes).padStart(2, '0')}` 
    : `${minutes}min`;

  const tss = workout.tssFinal ?? workout.tssSubjective;
  const tssType = workout.tssVersion === 'v2_hybrid' && workout.sessionType === 'endurance' 
    ? 'hrTSS' 
    : 'rTSS';

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      colorClass
    )}>
      {/* Workout Icon */}
      <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>

      {/* Workout Details */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{workout.type}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{durationFormatted}</span>
          {workout.distanceKm && (
            <>
              <span>•</span>
              <span>{workout.distanceKm.toFixed(1)} km</span>
            </>
          )}
          {workout.avgHr && (
            <>
              <span>•</span>
              <span>{workout.avgHr} bpm</span>
            </>
          )}
          <span>•</span>
          <span>RPE {workout.rpe}</span>
        </div>
      </div>

      {/* TSS */}
      <div className="text-right shrink-0">
        <div className="font-bold text-foreground">{Math.round(tss)}</div>
        <div className="text-[10px] text-muted-foreground uppercase">{tssType}</div>
      </div>
    </div>
  );
}
