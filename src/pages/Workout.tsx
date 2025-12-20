import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useData } from '@/hooks/useData';
import { calculateTssSubjective, getHRVMetrics } from '@/lib/calculations';
import { Workout as WorkoutType, WorkoutType as WorkoutTypeEnum } from '@/types/health';
import { useToast } from '@/hooks/use-toast';
import { Dumbbell, Bike, Timer, Activity, Check, MapPin, Heart, CalendarIcon } from 'lucide-react';

const workoutTypes: { type: WorkoutTypeEnum; label: string; icon: React.ReactNode }[] = [
  { type: 'Run', label: 'Corrida', icon: <Activity className="w-5 h-5" /> },
  { type: 'Strength', label: 'Musculação', icon: <Dumbbell className="w-5 h-5" /> },
  { type: 'Bike', label: 'Bike', icon: <Bike className="w-5 h-5" /> },
  { type: 'Rest', label: 'Descanso', icon: <Timer className="w-5 h-5" /> },
];

const muscleGroupOptions = [
  { id: 'chest', label: 'Peito' },
  { id: 'back', label: 'Costas' },
  { id: 'shoulders', label: 'Ombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'core', label: 'Core' },
  { id: 'quads', label: 'Quadríceps' },
  { id: 'hamstrings', label: 'Posteriores' },
  { id: 'glutes', label: 'Glúteos' },
  { id: 'calves', label: 'Panturrilha' },
];

export default function Workout() {
  const { toast } = useToast();
  const { dailyChecks, workouts, saveWorkout } = useData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedType, setSelectedType] = useState<WorkoutTypeEnum | null>(null);
  const [duration, setDuration] = useState<number | undefined>();
  const [rpe, setRpe] = useState<number>(5);
  const [validated, setValidated] = useState(false);
  const [distance, setDistance] = useState<number | undefined>();
  const [avgHr, setAvgHr] = useState<number | undefined>();
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const tssSubjective = duration && rpe ? calculateTssSubjective(duration, rpe) : 0;
  const hrvMetrics = getHRVMetrics(dateString, dailyChecks);
  const tssEffective = Math.round(tssSubjective * (hrvMetrics?.factor ?? 1.0));

  const toggleMuscleGroup = (groupId: string) => {
    setMuscleGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
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
      id: '', // Empty string - Supabase will generate UUID
      date: dateString,
      type: selectedType,
      durationMin: selectedType === 'Rest' ? 0 : (duration || 0),
      rpe: selectedType === 'Rest' ? 0 : rpe,
      tssSubjective: selectedType === 'Rest' ? 0 : tssSubjective,
      validated: selectedType === 'Strength' ? validated : true,
      distanceKm: (selectedType === 'Run' || selectedType === 'Bike') ? distance : undefined,
      avgHr: (selectedType === 'Run' || selectedType === 'Bike') ? avgHr : undefined,
      muscleGroups: selectedType === 'Strength' && muscleGroups.length > 0 ? muscleGroups : undefined,
    };
    
    const success = await saveWorkout(workout);
    
    if (success) {
      toast({
        title: 'Treino registrado!',
        description: `${selectedType === 'Rest' ? 'Dia de descanso' : `TSS efetivo: ${tssEffective}`}`,
      });
      
      // Reset form
      setSelectedType(null);
      setDuration(undefined);
      setRpe(5);
      setValidated(false);
      setDistance(undefined);
      setAvgHr(undefined);
      setMuscleGroups([]);
    } else {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o treino.',
        variant: 'destructive',
      });
    }
  };
  
  const selectedDateWorkouts = workouts.filter(w => w.date === dateString);

  const getMuscleGroupLabel = (id: string) => {
    return muscleGroupOptions.find(m => m.id === id)?.label || id;
  };
  
  return (
    <PageContainer 
      title="Registrar Treino" 
      subtitle={
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date > new Date()}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      }
    >
      {selectedDateWorkouts.length > 0 && (
        <div className="gradient-card rounded-xl p-4 border border-border/50 mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            {isToday(selectedDate) ? 'Treinos de hoje' : `Treinos de ${format(selectedDate, "d 'de' MMMM", { locale: ptBR })}`}
          </p>
          <div className="space-y-2">
            {selectedDateWorkouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{w.type}</span>
                <span className="text-muted-foreground">
                  {w.durationMin}min
                  {(w.type === 'Run' || w.type === 'Bike') && w.distanceKm && ` • ${w.distanceKm}km`}
                  {(w.type === 'Run' || w.type === 'Bike') && w.avgHr && ` • FC ${w.avgHr}`}
                  {w.type === 'Strength' && w.muscleGroups && w.muscleGroups.length > 0 && ` • ${w.muscleGroups.map(getMuscleGroupLabel).join(', ')}`}
                  {' '}• RPE {w.rpe} • TSS {w.tssSubjective}
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
            
            {(selectedType === 'Run' || selectedType === 'Bike') && (
              <div className="grid grid-cols-2 gap-4 animate-slide-up">
                <div className="space-y-2">
                  <Label htmlFor="distance" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Distância (km)
                  </Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 10.5"
                    value={distance || ''}
                    onChange={(e) => setDistance(Number(e.target.value) || undefined)}
                    className="text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avgHr" className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" />
                    FC Média (bpm)
                  </Label>
                  <Input
                    id="avgHr"
                    type="number"
                    placeholder="Ex: 145"
                    value={avgHr || ''}
                    onChange={(e) => setAvgHr(Number(e.target.value) || undefined)}
                    className="text-lg"
                  />
                </div>
              </div>
            )}

            {selectedType === 'Strength' && (
              <div className="space-y-3 animate-slide-up">
                <Label className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  Grupos Musculares
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {muscleGroupOptions.map((group) => (
                    <label
                      key={group.id}
                      htmlFor={group.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        muscleGroups.includes(group.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-secondary border-border hover:border-primary/50'
                      }`}
                    >
                      <Checkbox
                        id={group.id}
                        checked={muscleGroups.includes(group.id)}
                        onCheckedChange={() => toggleMuscleGroup(group.id)}
                      />
                      <span className="text-sm font-medium">
                        {group.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
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
