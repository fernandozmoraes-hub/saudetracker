import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, getISOWeek, getYear } from 'date-fns';

interface CalendarHeaderProps {
  currentDate: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function CalendarHeader({
  currentDate,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: CalendarHeaderProps) {
  const weekNumber = getISOWeek(currentDate);
  const year = getYear(currentDate);
  const isCurrentWeek = format(new Date(), 'yyyy-ww') === format(currentDate, 'yyyy-ww');

  return (
    <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPreviousWeek}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="text-center min-w-[100px]">
          <div className="text-sm font-semibold text-foreground">
            Semana {weekNumber}
          </div>
          <div className="text-xs text-muted-foreground">
            {year}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNextWeek}
          className="h-9 w-9"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Button
        variant={isCurrentWeek ? "secondary" : "outline"}
        size="sm"
        onClick={onToday}
        className="gap-2"
      >
        <CalendarDays className="h-4 w-4" />
        Hoje
      </Button>
    </div>
  );
}
