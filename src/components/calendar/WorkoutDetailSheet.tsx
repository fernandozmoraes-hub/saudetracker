import { Workout, TssMethod } from '@/types/health';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Footprints, Dumbbell, Bike, Bed, Timer, MapPin, Heart, Activity, Zap, Pencil, Trash2 } from 'lucide-react';

interface WorkoutDetailSheetProps {
  workout: Workout | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const workoutIcons = {
  Run: Footprints,
  Strength: Dumbbell,
  Bike: Bike,
  Rest: Bed,
};

const workoutLabels = {
  Run: 'Corrida',
  Strength: 'Musculação',
  Bike: 'Bike',
  Rest: 'Descanso',
};

const getTssMethodLabel = (method?: TssMethod): string => {
  switch (method) {
    case 'HR_zones': return 'HR-TSS (Zonas)';
    case 'HR_avg': return 'HR-TSS (FC média)';
    case 'RPE': return 'RPE-TSS';
    default: return 'TSS';
  }
};

const getTssMethodBadgeClass = (method?: TssMethod): string => {
  switch (method) {
    case 'HR_zones': return 'bg-accent/20 text-accent';
    case 'HR_avg': return 'bg-primary/20 text-primary';
    case 'RPE': return 'bg-green-500/20 text-green-500';
    default: return 'bg-secondary text-muted-foreground';
  }
};

const muscleGroupLabels: Record<string, string> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  core: 'Core',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  glutes: 'Glúteos',
  calves: 'Panturrilha',
};

export function WorkoutDetailSheet({ workout, open, onOpenChange }: WorkoutDetailSheetProps) {
  const navigate = useNavigate();
  const { deleteWorkout } = useData();
  const { toast } = useToast();

  if (!workout) return null;

  const Icon = workoutIcons[workout.type] || Footprints;
  const label = workoutLabels[workout.type] || workout.type;

  const hours = Math.floor(workout.durationMin / 60);
  const minutes = Math.round(workout.durationMin % 60);
  const durationFormatted = hours > 0 
    ? `${hours}h ${minutes}min` 
    : `${minutes} min`;

  const tss = workout.tssFinal ?? workout.tssSubjective;
  const hasZoneTimes = workout.timeZ1Min || workout.timeZ2Min || workout.timeZ3Min || workout.timeZ4Min || workout.timeZ5Min;

  const handleEdit = () => {
    onOpenChange(false);
    navigate('/workout', { state: { editWorkout: workout } });
  };

  const handleDelete = async () => {
    const success = await deleteWorkout(workout.id);
    if (success) {
      toast({
        title: 'Treino excluído',
        description: 'O treino foi removido com sucesso.',
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o treino.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl">{label}</SheetTitle>
              <SheetDescription>
                {format(new Date(workout.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* TSS Card */}
          <div className="gradient-card rounded-xl p-4 border border-primary/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">TSS Final</p>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", getTssMethodBadgeClass(workout.tssMethod))}>
                {getTssMethodLabel(workout.tssMethod)}
              </span>
            </div>
            <p className="text-3xl font-display font-bold text-primary">{Math.round(tss)}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {workout.durationMin > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="font-medium">{durationFormatted}</p>
                </div>
              </div>
            )}

            {workout.distanceKm && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="font-medium">{workout.distanceKm.toFixed(2)} km</p>
                </div>
              </div>
            )}

            {workout.avgHr && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                <Heart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">FC Média</p>
                  <p className="font-medium">{workout.avgHr} bpm</p>
                </div>
              </div>
            )}

            {workout.rpe > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">RPE</p>
                  <p className="font-medium">{workout.rpe}/10</p>
                </div>
              </div>
            )}
          </div>

          {/* HR Zone Times */}
          {hasZoneTimes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span>Tempo por Zona de FC</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-400">Z1</p>
                  <p className="font-medium text-sm">{workout.timeZ1Min || 0}m</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-400">Z2</p>
                  <p className="font-medium text-sm">{workout.timeZ2Min || 0}m</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400">Z3</p>
                  <p className="font-medium text-sm">{workout.timeZ3Min || 0}m</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-orange-400">Z4</p>
                  <p className="font-medium text-sm">{workout.timeZ4Min || 0}m</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">Z5</p>
                  <p className="font-medium text-sm">{workout.timeZ5Min || 0}m</p>
                </div>
              </div>
            </div>
          )}

          {/* Muscle Groups */}
          {workout.muscleGroups && workout.muscleGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Dumbbell className="h-4 w-4" />
                <span>Grupos Musculares</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {workout.muscleGroups.map((group) => (
                  <span
                    key={group}
                    className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                  >
                    {muscleGroupLabels[group] || group}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita. O treino será permanentemente removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
