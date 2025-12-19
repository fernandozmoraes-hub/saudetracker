import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveWorkout, getWorkoutsByDate } from '@/lib/storage';
import { calculateTssSubjective, getHRVMetrics } from '@/lib/calculations';
import { Workout as WorkoutType, WorkoutType as WorkoutTypeEnum } from '@/types/health';
import { useToast } from '@/hooks/use-toast';
import { Dumbbell, Bike, Timer, Activity, Check } from 'lucide-react';

const workoutTypes: { type: WorkoutTypeEnum; label: string; icon: React.ReactNode }[] = [
  { type: 'Run', label: 'Corrida', icon: <Activity className="w-5 h-5" /> },
  { type: 'Strength', label: 'Musculação', icon: <Dumbbell className="w-5 h-5" /> },
  { type: 'Bike', label: 'Bike', icon: <Bike className="w-5 h-5" /> },
  { type: 'Rest', label: 'Descanso', icon: <Timer className="w-5 h-5" /> },
];

export default function Workout() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { toast } = useToast();
  
  const [selectedType, setSelectedType] = useState<WorkoutTypeEnum | null>(null);
  const [duration, setDuration] = useState<number | undefined>();
  const [rpe, setRpe] = useState<number>(5);
  const [validated, setValidated] = useState(false);
  
  const tssSubjective = duration && rpe ? calculateTssSubjective(duration, rpe) : 0;
  const hrvMetrics = getHRVMetrics(today);
  const tssEffective = Math.round(tssSubjective * (hrvMetrics?.factor ?? 1.0));
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      toast({
        title: 'Selecione o tipo',
        description: 'Escolha o tipo de treino',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedType !== 'Rest' && !duration) {
      toast({
        title: 'Duração obrigatória',
        description: 'Informe a duração do treino',
        variant: 'destructive',
      });
      return;
    }
    
    const workout: WorkoutType = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: today,
      type: selectedType,
      durationMin: selectedType === 'Rest' ? 0 : (duration || 0),
      rpe: selectedType === 'Rest' ? 0 : rpe,
      tssSubjective: selectedType === 'Rest' ? 0 : tssSubjective,
      validated: selectedType === 'Strength' ? validated : true,
    };
    
    saveWorkout(workout);
    
    toast({
      title: 'Treino registrado!',
      description: `${selectedType === 'Rest' ? 'Dia de descanso' : `TSS efetivo: ${tssEffective}`}`,
    });
    
    // Reset form
    setSelectedType(null);
    setDuration(undefined);
    setRpe(5);
    setValidated(false);
  };
  
  const todayWorkouts = getWorkoutsByDate(today);
  
  return (
    <PageContainer 
      title="Registrar Treino" 
      subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
    >
      {todayWorkouts.length > 0 && (
        <div className="gradient-card rounded-xl p-4 border border-border/50 mb-4">
          <p className="text-sm text-muted-foreground mb-2">Treinos de hoje</p>
          <div className="space-y-2">
            {todayWorkouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{w.type}</span>
                <span className="text-muted-foreground">
                  {w.durationMin}min • RPE {w.rpe} • TSS {w.tssSubjective}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <Label>Tipo de Treino</Label>
          <div className="grid grid-cols-2 gap-3">
            {workoutTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                  selectedType === type
                    ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                    : 'bg-secondary border-border hover:border-primary/50'
                }`}
              >
                {icon}
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {selectedType && selectedType !== 'Rest' && (
          <>
            <div className="space-y-2 animate-slide-up">
              <Label htmlFor="duration" className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-primary" />
                Duração (minutos)
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="Ex: 45"
                value={duration || ''}
                onChange={(e) => setDuration(Number(e.target.value) || undefined)}
                className="text-lg"
              />
            </div>
            
            <div className="space-y-3 animate-slide-up">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" />
                  RPE (0-10)
                </span>
                <span className="text-2xl font-display font-bold text-primary">{rpe}</span>
              </Label>
              <input
                type="range"
                min="0"
                max="10"
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Muito fácil</span>
                <span>Máximo</span>
              </div>
            </div>
            
            {selectedType === 'Strength' && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary border border-border animate-slide-up">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Treino Validado</p>
                    <p className="text-sm text-muted-foreground">Completou todos os sets?</p>
                  </div>
                </div>
                <Switch
                  checked={validated}
                  onCheckedChange={setValidated}
                />
              </div>
            )}
            
            {duration && rpe > 0 && (
              <div className="grid grid-cols-2 gap-4 animate-slide-up">
                <div className="gradient-card rounded-xl p-4 border border-border/50">
                  <p className="text-sm text-muted-foreground">TSS Subjetivo</p>
                  <p className="text-2xl font-display font-bold">{tssSubjective}</p>
                </div>
                <div className="gradient-card rounded-xl p-4 border border-primary/30">
                  <p className="text-sm text-muted-foreground">TSS Efetivo</p>
                  <p className="text-2xl font-display font-bold text-primary">{tssEffective}</p>
                  {hrvMetrics && hrvMetrics.factor < 1 && (
                    <p className="text-xs text-status-alert mt-1">
                      HRV fator: {hrvMetrics.factor}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-12 text-lg font-semibold"
          disabled={!selectedType}
        >
          {selectedType === 'Rest' ? 'Registrar Descanso' : 'Salvar Treino'}
        </Button>
      </form>
    </PageContainer>
  );
}
