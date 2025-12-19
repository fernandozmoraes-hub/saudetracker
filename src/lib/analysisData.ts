import { format, subDays } from 'date-fns';
import { DailyCheck, Workout } from '@/types/health';
import { getHRVMetrics, calculateATL, calculateCTL, getHRVBaseline7d } from './calculations';
import { AnalysisData, TriggerResult, evaluateTriggers } from './triggers';

export function buildAnalysisData(dailyChecks: DailyCheck[], workouts: Workout[]): { data: AnalysisData | null; triggerResult: TriggerResult } {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const todayCheck = dailyChecks.find(c => c.date === today);
  const hrvMetrics = getHRVMetrics(today, dailyChecks);
  
  // Check for minimum data
  if (!todayCheck) {
    return {
      data: null,
      triggerResult: {
        classification: 'blocked',
        reasons: ['Check-in de hoje não encontrado'],
        canProceed: false
      }
    };
  }
  
  const atl = calculateATL(today, dailyChecks, workouts);
  const ctl = calculateCTL(today, dailyChecks, workouts);
  const tsb = ctl - atl;
  const baseline = getHRVBaseline7d(today, dailyChecks);
  
  // Calculate consecutive critical days
  let consecutiveCriticalDays = 0;
  for (let i = 0; i <= 7; i++) {
    const checkDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const hrv = getHRVMetrics(checkDate, dailyChecks);
    if (hrv?.status === 'Critical') {
      consecutiveCriticalDays++;
    } else {
      break;
    }
  }
  
  // Calculate consecutive low sleep days
  let consecutiveLowSleepDays = 0;
  for (let i = 0; i <= 7; i++) {
    const checkDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const check = dailyChecks.find(c => c.date === checkDate);
    if (check && check.sleepHours < 6) {
      consecutiveLowSleepDays++;
    } else {
      break;
    }
  }
  
  // Calculate ATL trend (last 5 days)
  const atlValues: number[] = [];
  for (let i = 0; i < 5; i++) {
    const checkDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    atlValues.push(calculateATL(checkDate, dailyChecks, workouts));
  }
  
  let atlTrend5d: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (atlValues.length >= 3) {
    const recentAvg = (atlValues[0] + atlValues[1]) / 2;
    const olderAvg = (atlValues[3] + atlValues[4]) / 2;
    const diff = recentAvg - olderAvg;
    if (diff > 5) atlTrend5d = 'increasing';
    else if (diff < -5) atlTrend5d = 'decreasing';
  }
  
  // Get recent workouts (last 7 days)
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const recentWorkouts = workouts
    .filter(w => w.date >= sevenDaysAgo && w.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  const hrvVsBaseline = baseline > 0 
    ? ((todayCheck.hrv - baseline) / baseline) * 100 
    : 0;
  
  const analysisData: AnalysisData = {
    today: {
      hrv: todayCheck.hrv,
      hrvStatus: hrvMetrics?.status || 'OK',
      restingHr: todayCheck.restingHr,
      sleepHours: todayCheck.sleepHours,
      sleepQuality: todayCheck.sleepQuality,
      bodyBattery: todayCheck.bodyBattery,
      mood: todayCheck.mood,
    },
    trainingLoad: {
      atl,
      ctl,
      tsb,
    },
    trends: {
      hrvBaseline7d: baseline,
      hrvVsBaseline,
      consecutiveCriticalDays,
      consecutiveLowSleepDays,
      atlTrend5d,
    },
    recentWorkouts,
  };
  
  const triggerResult = evaluateTriggers(analysisData);
  
  return { data: analysisData, triggerResult };
}
