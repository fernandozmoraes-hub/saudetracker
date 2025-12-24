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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useData } from '@/hooks/useData';
import { useUserSettings } from '@/hooks/useUserSettings';
import { calculateTssSubjective, calculateTssFinal, getHrZones, ZoneTimeInputs } from '@/lib/calculations';
import { Workout as WorkoutType, WorkoutType as WorkoutTypeEnum, TssMethod } from '@/types/health';
import { useToast } from '@/hooks/use-toast';
import { Dumbbell, Bike, Timer, Activity, Check, MapPin, Heart, CalendarIcon, Settings, Info, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export default function Workout() {
  const { toast } = useToast();
  const { workouts, saveWorkout } = useData();
  const { settings } = useUserSettings();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedType, setSelectedType] = useState<WorkoutTypeEnum | null>(null);
  const [duration, setDuration] = useState<number | undefined>();
  const [rpe, setRpe] = useState<number>(5);
  const [validated, setValidated] = useState(false);
  const [distance, setDistance] = useState<number | undefined>();
  const [avgHr, setAvgHr] = useState<number | undefined>();
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  
  // HR Zone times
  const [useZoneTimes, setUseZoneTimes] = useState(false);
  const [timeZ1, setTimeZ1] = useState<number>(0);
  const [timeZ2, setTimeZ2] = useState<number>(0);
  const [timeZ3, setTimeZ3] = useState<number>(0);
  const [timeZ4, setTimeZ4] = useState<number>(0);
  const [timeZ5, setTimeZ5] = useState<number>(0);
  
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  
  // Get zone info for display
  const zones = getHrZones(
    settings.lthr, 
    settings.zone1UpperPct, 
    settings.zone2UpperPct, 
    settings.zone3UpperPct, 
    settings.zone4UpperPct
  );
  
  // Calculate zone totals
  const zoneTotalMin = timeZ1 + timeZ2 + timeZ3 + timeZ4 + timeZ5;
  const zoneTimesValid = !useZoneTimes || !duration || Math.abs(zoneTotalMin - duration) < 0.5;
  
  // Build zone times object
  const zoneTimes: ZoneTimeInputs | undefined = useZoneTimes && zoneTotalMin > 0 ? {
    timeZ1Min: timeZ1,
    timeZ2Min: timeZ2,
    timeZ3Min: timeZ3,
    timeZ4Min: timeZ4,
    timeZ5Min: timeZ5,
  } : undefined;
  
  // Calculate TSS using the new hybrid model
  const tssResult = selectedType && duration && rpe 
    ? calculateTssFinal(selectedType, duration, rpe, validated, avgHr, settings.lthr, zoneTimes)
    : null;
  
  const tssSubjective = duration && rpe ? calculateTssSubjective(duration, rpe) : 0;

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
    
    // Validate zone times if enabled
    if (useZoneTimes && duration && Math.abs(zoneTotalMin - duration) >= 0.5) {
      toast({
        title: 'Tempo por zona inválido',
        description: `A soma dos tempos (${zoneTotalMin.toFixed(1)}min) deve ser igual à duração (${duration}min)`,
        variant: 'destructive',
      });
      return;
    }
    
    // Use TSS v2 hybrid model
    const tssCalc = calculateTssFinal(
      selectedType, 
      duration || 0, 
      rpe, 
      validated, 
      avgHr, 
      settings.lthr,
      zoneTimes
    );
    
    const workout: WorkoutType = {
      id: '', // Empty string - Supabase will generate UUID
      date: dateString,
      type: selectedType,
      sessionType: tssCalc.sessionType,
      tssVersion: tssCalc.tssVersion,
      durationMin: selectedType === 'Rest' ? 0 : (duration || 0),
      rpe: selectedType === 'Rest' ? 0 : rpe,
      tssSubjective: selectedType === 'Rest' ? 0 : tssSubjective,
      tssFinal: tssCalc.tssFinal,
      validated: selectedType === 'Strength' ? validated : true,
      distanceKm: (selectedType === 'Run' || selectedType === 'Bike') ? distance : undefined,
      avgHr: (selectedType === 'Run' || selectedType === 'Bike') ? avgHr : undefined,
      lthrUsed: tssCalc.lthrUsed,
      muscleGroups: selectedType === 'Strength' && muscleGroups.length > 0 ? muscleGroups : undefined,
      // HR Zone times
      timeZ1Min: zoneTimes?.timeZ1Min,
      timeZ2Min: zoneTimes?.timeZ2Min,
      timeZ3Min: zoneTimes?.timeZ3Min,
      timeZ4Min: zoneTimes?.timeZ4Min,
      timeZ5Min: zoneTimes?.timeZ5Min,
      tssMethod: tssCalc.tssMethod,
    };
    
    const success = await saveWorkout(workout);
    
    if (success) {
      toast({
        title: 'Treino registrado!',
        description: `${selectedType === 'Rest' ? 'Dia de descanso' : `TSS: ${tssCalc.tssFinal} (${getTssMethodLabel(tssCalc.tssMethod)})`}`,
      });
      
      // Reset form
      setSelectedType(null);
      setDuration(undefined);
      setRpe(5);
      setValidated(false);
      setDistance(undefined);
      setAvgHr(undefined);
      setMuscleGroups([]);
      setUseZoneTimes(false);
      setTimeZ1(0);
      setTimeZ2(0);
      setTimeZ3(0);
      setTimeZ4(0);
      setTimeZ5(0);
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
                <div className="text-right text-muted-foreground">
                  <span>
                    {w.durationMin}min
                    {(w.type === 'Run' || w.type === 'Bike') && w.distanceKm && ` • ${w.distanceKm}km`}
                    {(w.type === 'Run' || w.type === 'Bike') && w.avgHr && ` • FC ${w.avgHr}`}
                    {w.type === 'Strength' && w.muscleGroups && w.muscleGroups.length > 0 && ` • ${w.muscleGroups.map(getMuscleGroupLabel).join(', ')}`}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="font-medium text-foreground">
                      TSS: {w.tssFinal ?? w.tssSubjective}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getTssMethodBadgeClass(w.tssMethod)}`}>
                      {getTssMethodLabel(w.tssMethod)}
                    </span>
                  </div>
                </div>
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
                step="0.01"
                min="0.01"
                placeholder="Ex: 45.50"
                value={duration || ''}
                onChange={(e) => setDuration(Number(e.target.value) || undefined)}
                className="text-lg"
              />
            </div>
            
            {(selectedType === 'Run' || selectedType === 'Bike') && (
              <>
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

                {/* HR Zone Times Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary border border-border animate-slide-up">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-accent" />
                    <div>
                      <p className="font-medium">Tempo por Zona de FC</p>
                      <p className="text-sm text-muted-foreground">Cálculo HR-TSS mais preciso</p>
                    </div>
                  </div>
                  <Switch
                    checked={useZoneTimes}
                    onCheckedChange={setUseZoneTimes}
                  />
                </div>

                {/* HR Zone Time Inputs */}
                {useZoneTimes && (
                  <div className="space-y-3 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-accent" />
                        Minutos por Zona
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>A soma dos tempos deve ser igual à duração total do treino. Consulte seu relógio/app para os tempos em cada zona.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-400">Z1</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={timeZ1 || ''}
                          onChange={(e) => setTimeZ1(Number(e.target.value) || 0)}
                          className="h-10 text-center"
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground text-center">≤{zones[0].upperBpm}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-green-400">Z2</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={timeZ2 || ''}
                          onChange={(e) => setTimeZ2(Number(e.target.value) || 0)}
                          className="h-10 text-center"
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground text-center">{zones[1].lowerBpm}-{zones[1].upperBpm}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-yellow-400">Z3</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={timeZ3 || ''}
                          onChange={(e) => setTimeZ3(Number(e.target.value) || 0)}
                          className="h-10 text-center"
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground text-center">{zones[2].lowerBpm}-{zones[2].upperBpm}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-orange-400">Z4</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={timeZ4 || ''}
                          onChange={(e) => setTimeZ4(Number(e.target.value) || 0)}
                          className="h-10 text-center"
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground text-center">{zones[3].lowerBpm}-{zones[3].upperBpm}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-red-400">Z5</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={timeZ5 || ''}
                          onChange={(e) => setTimeZ5(Number(e.target.value) || 0)}
                          className="h-10 text-center"
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground text-center">≥{zones[4].lowerBpm}</p>
                      </div>
                    </div>

                    {/* Zone times validation */}
                    <div className={`text-sm p-2 rounded-lg ${zoneTimesValid ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                      Total: {zoneTotalMin.toFixed(1)}min {duration ? `/ ${duration}min` : ''}
                      {!zoneTimesValid && ' — Ajuste os tempos!'}
                    </div>
                  </div>
                )}
              </>
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
            
            {duration && rpe > 0 && tssResult && (
              <div className="space-y-3 animate-slide-up">
                <div className="gradient-card rounded-xl p-4 border border-primary/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">TSS Final</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getTssMethodBadgeClass(tssResult.tssMethod)}`}>
                      {getTssMethodLabel(tssResult.tssMethod)}
                    </span>
                  </div>
                  <p className="text-3xl font-display font-bold text-primary">{tssResult.tssFinal}</p>
                  
                  {/* Show calculation details */}
                  <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground space-y-1">
                    {tssResult.tssMethod === 'HR_zones' && (
                      <>
                        <p>Cálculo baseado em tempo por zona de FC</p>
                        <p>LTHR usado: {tssResult.lthrUsed} bpm 
                          <Link to="/settings" className="text-primary hover:underline ml-1">
                            <Settings className="w-3 h-3 inline" />
                          </Link>
                        </p>
                      </>
                    )}
                    {tssResult.tssMethod === 'HR_avg' && (
                      <>
                        <p>Cálculo baseado em FC média</p>
                        <p>LTHR usado: {tssResult.lthrUsed} bpm 
                          <Link to="/settings" className="text-primary hover:underline ml-1">
                            <Settings className="w-3 h-3 inline" />
                          </Link>
                        </p>
                      </>
                    )}
                    {tssResult.tssMethod === 'RPE' && tssResult.sessionType === 'strength' && (
                      <p>Cálculo baseado em RPE {validated ? '(validado)' : '(×0.7)'}</p>
                    )}
                    {tssResult.tssMethod === 'RPE' && tssResult.sessionType === 'legacy' && (
                      <p>Cálculo legado (RPE × duração)</p>
                    )}
                  </div>
                </div>

                {/* Comparison with RPE-TSS for endurance */}
                {tssResult.sessionType === 'endurance' && (tssResult.tssMethod === 'HR_zones' || tssResult.tssMethod === 'HR_avg') && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
                    <span className="text-muted-foreground">TSS por RPE (comparação):</span>
                    <span className="font-medium">{tssSubjective}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-12 text-lg font-semibold"
          disabled={!selectedType || (useZoneTimes && !zoneTimesValid)}
        >
          {selectedType === 'Rest' ? 'Registrar Descanso' : 'Salvar Treino'}
        </Button>
      </form>
    </PageContainer>
  );
}
