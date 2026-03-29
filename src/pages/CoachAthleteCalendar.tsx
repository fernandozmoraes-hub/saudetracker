import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CoachCalendarDay } from '@/components/coach/CoachCalendarDay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlans, TrainingPlan } from '@/hooks/useTrainingPlans';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
} from 'date-fns';

interface Workout {
  id: string;
  date: string;
  type: string;
  duration_min: number;
  rpe: number;
  tss_final: number | null;
  tss_subjective: number;
}

export default function CoachAthleteCalendar() {
  const { id: athleteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans } = useTrainingPlans(athleteId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const fetchWorkouts = useCallback(async () => {
    if (!user || !athleteId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, date, type, duration_min, rpe, tss_final, tss_subjective')
        .eq('user_id', athleteId)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date');

      if (error) throw error;
      setWorkouts((data as Workout[]) || []);
    } catch (err) {
      console.error('Error fetching workouts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, athleteId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Weekly summary calculations
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const weekPlans = plans.filter(p => p.date >= weekStartStr && p.date <= weekEndStr);
  const weekWorkouts = workouts;

  const planned = weekPlans.length;
  const completed = weekPlans.filter(p => p.status === 'completed').length;
  const skipped = weekPlans.filter(p => p.status === 'skipped').length;

  const plannedWorkoutIds = new Set(weekPlans.map(p => p.workout_id).filter(Boolean));
  const extras = weekWorkouts.filter(w => !plannedWorkoutIds.has(w.id)).length;

  const tssPlanned = weekPlans.reduce((sum, p) => sum + (p.planned_tss || 0), 0);
  const tssRealized = weekWorkouts.reduce((sum, w) => sum + (Number(w.tss_final) || w.tss_subjective || 0), 0);
  const tssPercent = tssPlanned > 0 ? Math.min(Math.round((tssRealized / tssPlanned) * 100), 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer title="Calendário do Atleta" subtitle={athleteId?.slice(0, 8) + '...'}>
      <div className="space-y-4 pb-20">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/coach/athlete/${athleteId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Perfil
        </Button>

        <CalendarHeader
          currentDate={currentDate}
          onPreviousWeek={() => setCurrentDate(prev => subWeeks(prev, 1))}
          onNextWeek={() => setCurrentDate(prev => addWeeks(prev, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

        {/* Weekly Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo Semanal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{planned}</p>
                <p className="text-[10px] text-muted-foreground">Planejados</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{completed}</p>
                <p className="text-[10px] text-muted-foreground">Concluídos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{skipped}</p>
                <p className="text-[10px] text-muted-foreground">Pulados</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{extras}</p>
                <p className="text-[10px] text-muted-foreground">Extras</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>TSS: {Math.round(tssRealized)} / {Math.round(tssPlanned)}</span>
                <span>{tssPercent}%</span>
              </div>
              <Progress value={tssPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* 7-day grid */}
        <div className="grid grid-cols-1 gap-3">
          {days.map(day => (
            <CoachCalendarDay
              key={format(day, 'yyyy-MM-dd')}
              date={day}
              plans={plans}
              workouts={workouts}
            />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
