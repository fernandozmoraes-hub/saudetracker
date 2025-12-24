import { DailyCheck } from '@/types/health';
import { Moon, Battery, Heart, Activity } from 'lucide-react';

interface DayMetricsCardProps {
  dailyCheck: DailyCheck;
}

export function DayMetricsCard({ dailyCheck }: DayMetricsCardProps) {
  return (
    <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
      {/* Sleep */}
      <div className="flex items-center gap-1.5 text-sm">
        <Moon className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-muted-foreground">{dailyCheck.sleepHours.toFixed(1)}h</span>
      </div>

      {/* HRV */}
      <div className="flex items-center gap-1.5 text-sm">
        <Activity className="h-3.5 w-3.5 text-green-400" />
        <span className="text-muted-foreground">{dailyCheck.hrv} ms</span>
      </div>

      {/* Resting HR */}
      <div className="flex items-center gap-1.5 text-sm">
        <Heart className="h-3.5 w-3.5 text-red-400" />
        <span className="text-muted-foreground">{dailyCheck.restingHr} bpm</span>
      </div>

      {/* Body Battery */}
      {dailyCheck.bodyBattery !== undefined && dailyCheck.bodyBattery !== null && (
        <div className="flex items-center gap-1.5 text-sm">
          <Battery className="h-3.5 w-3.5 text-yellow-400" />
          <span className="text-muted-foreground">{dailyCheck.bodyBattery}%</span>
        </div>
      )}
    </div>
  );
}
