import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { PageContainer } from '@/components/layout/PageContainer';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarDay } from '@/components/calendar/CalendarDay';
import { WeeklySummary } from '@/components/calendar/WeeklySummary';
import { Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Calendar() {
  const { dailyChecks, workouts, isLoading } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: ptBR })} - ${format(weekEnd, "d 'de' MMM", { locale: ptBR })}`;

  return (
    <PageContainer title="Calendário" subtitle={weekLabel}>
      <div className="space-y-4 pb-20">
        <CalendarHeader
          currentDate={currentDate}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
        />

        {/* Weekly Summary Panel */}
        <WeeklySummary
          weekStart={weekStart}
          weekEnd={weekEnd}
          workouts={workouts}
        />

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 gap-3">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayCheck = dailyChecks.find(c => c.date === dateStr);
            const dayWorkouts = workouts.filter(w => w.date === dateStr);

            return (
              <CalendarDay
                key={dateStr}
                date={day}
                dailyCheck={dayCheck}
                workouts={dayWorkouts}
              />
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
