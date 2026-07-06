import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CoachCalendarDay } from '@/components/coach/CoachCalendarDay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlans, TrainingPlan } from '@/hooks/useTrainingPlans';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CoachAthleteCalendar() {
  const { id: athleteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans, isLoading: plansLoading } = useTrainingPlans(athleteId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [athleteName, setAthleteName] = useState('');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: ptBR })} — ${format(weekEnd, "d 'de' MMM", { locale: ptBR })}`;

  // Fetch athlete name
  useEffect(() => {
    if (!athleteId) return;
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', athleteId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAthleteName((data as any).display_name ?? (data as any).email ?? '');
      });
  }, [athleteId]);

  // Fetch workouts for the visible week
  const fetchWeekWorkouts = useCallback(async () => {
    if (!user || !athleteId) return;
    setWorkoutsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', athleteId)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;
      setWorkouts(data || []);
    } catch {
      toast.error('Erro ao carregar treinos realizados.');
    } finally {
      setWorkoutsLoading(false);
    }
  }, [user, athleteId, weekStart.toISOString()]);

  useEffect(() => {
    fetchWeekWorkouts();
  }, [fetchWeekWorkouts]);

  const isLoading = plansLoading || workoutsLoading;

  // Weekly compliance stats
  const weekPlans = plans.filter(
    (p) =>
      p.date >= format(weekStart, 'yyyy-MM-dd') &&
      p.date <= format(weekEnd, 'yyyy-MM-dd'),
  );
  const completed = weekPlans.filter((p) => p.status === 'completed').length;
  const skipped = weekPlans.filter((p) => p.status === 'skipped').length;
  const total = weekPlans.length;
  const extraWorkouts = workouts.filter(
    (w) => !weekPlans.some((p) => p.workout_id === w.id),
  ).length;

  const plannedTSS = weekPlans.reduce((s, p) => s + (Number(p.planned_tss) || 0), 0);
  const actualTSS = workouts.reduce(
    (s, w) => s + (Number(w.tss_final) || Number(w.tss_subjective) || 0),
    0,
  );

  return (
    <PageContainer
      title="Calendário do Atleta"
      subtitle={athleteName || weekLabel}
    >
      <div className="space-y-4 pb-20">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/coach/athlete/${athleteId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        {/* Week navigation */}
        <CalendarHeader
          currentDate={currentDate}
          onPreviousWeek={() => setCurrentDate(subWeeks(currentDate, 1))}
          onNextWeek={() => setCurrentDate(addWeeks(currentDate, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

        {/* Weekly compliance summary */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Semana: {weekLabel}</h3>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/50 space-y-0.5">
              <p className="text-lg font-bold text-foreground">{total}</p>
              <p className="text-[11px] text-muted-foreground">Planejados</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/10 space-y-0.5">
              <p className="text-lg font-bold text-green-400">{completed}</p>
              <p className="text-[11px] text-muted-foreground">Concluídos</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10 space-y-0.5">
              <p className="text-lg font-bold text-red-400">{skipped}</p>
              <p className="text-[11px] text-muted-foreground">Pulados</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/10 space-y-0.5">
              <p className="text-lg font-bold text-blue-400">{extraWorkouts}</p>
              <p className="text-[11px] text-muted-foreground">Extras</p>
            </div>
          </div>

          {/* TSS comparison bar */}
          {(plannedTSS > 0 || actualTSS > 0) && (
            <div className="mt-3 pt-3 border-t border-border space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>TSS Planejado: <strong className="text-foreground">{Math.round(plannedTSS)}</strong></span>
                <span>TSS Realizado: <strong className="text-green-400">{Math.round(actualTSS)}</strong></span>
              </div>
              {plannedTSS > 0 && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      actualTSS >= plannedTSS ? 'bg-green-500' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(100, (actualTSS / plannedTSS) * 100)}%` }}
                  />
                </div>
              )}
              {plannedTSS > 0 && (
                <p className="text-[11px] text-muted-foreground text-right">
                  {Math.round((actualTSS / plannedTSS) * 100)}% do volume planejado
                </p>
              )}
            </div>
          )}
        </div>

        {/* Days */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {weekDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayPlans = plans.filter((p) => p.date === dateStr);
              const dayWorkouts = workouts.filter((w: any) => w.date === dateStr);

              return (
                <CoachCalendarDay
                  key={dateStr}
                  date={day}
                  plans={dayPlans}
                  workouts={dayWorkouts}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
