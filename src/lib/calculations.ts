import { DailyCheck, Workout, HRVStatus, HRVMetrics, TodayMetrics, WeeklyLoad, SessionType, TssVersion } from '@/types/health';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, getISOWeek, getYear } from 'date-fns';

// ============================================================
// TSS v2 Hybrid Model - Calculation Functions
// ============================================================

// Default LTHR if user hasn't configured one
export const DEFAULT_LTHR = 165;

/**
 * Calculate RPE-based TSS (legacy and strength)
 * Formula: (duration × RPE) / 10
 * Used for: Strength training and legacy workouts
 */
export function calculateTssSubjective(durationMin: number, rpe: number): number {
  return Math.round((durationMin * rpe) / 10);
}

/**
 * Calculate RPE-TSS for strength training
 * Formula: (duration × RPE × validationFactor) / 10
 * validationFactor: 1.0 if validated, 0.7 if not validated
 * Used for: Strength/resistance training sessions
 */
export function calculateRpeTss(durationMin: number, rpe: number, validated: boolean = true): number {
  const validationFactor = validated ? 1.0 : 0.7;
  return Math.round((durationMin * rpe * validationFactor) / 10);
}

/**
 * Calculate Intensity Factor (IF) from heart rate
 * Formula: avgHR / LTHR
 * LTHR = Lactate Threshold Heart Rate (user configured, default 165 bpm)
 */
export function calculateIntensityFactor(avgHr: number, lthr: number = DEFAULT_LTHR): number {
  if (lthr <= 0) return 0;
  return avgHr / lthr;
}

/**
 * Calculate HR-TSS for endurance activities
 * Formula: (duration × IF²) × 100 / 60
 * Simplified: duration × IF² × 1.667
 * Where IF = avgHR / LTHR
 * Used for: Running, Cycling, and other cardio sessions with HR data
 */
export function calculateHrTss(durationMin: number, avgHr: number, lthr: number = DEFAULT_LTHR): number {
  if (!avgHr || avgHr <= 0 || lthr <= 0) return 0;
  
  const intensityFactor = calculateIntensityFactor(avgHr, lthr);
  // Formula: (duration in minutes × IF²) × 100 / 60
  const hrTss = (durationMin * intensityFactor * intensityFactor) * 100 / 60;
  
  return Math.round(hrTss);
}

/**
 * Determine session type based on workout type
 */
export function getSessionType(workoutType: string): SessionType {
  switch (workoutType) {
    case 'Run':
    case 'Bike':
      return 'endurance';
    case 'Strength':
      return 'strength';
    default:
      return 'legacy';
  }
}

/**
 * Calculate final TSS based on session type and available data
 * This is the main function that determines which TSS formula to use
 */
export interface TssCalculationResult {
  tssFinal: number;
  tssVersion: TssVersion;
  sessionType: SessionType;
  lthrUsed?: number;
}

export function calculateTssFinal(
  workoutType: string,
  durationMin: number,
  rpe: number,
  validated: boolean = true,
  avgHr?: number,
  lthr: number = DEFAULT_LTHR
): TssCalculationResult {
  const sessionType = getSessionType(workoutType);
  
  // Rest days have zero TSS
  if (workoutType === 'Rest') {
    return {
      tssFinal: 0,
      tssVersion: 'v2_hybrid',
      sessionType: 'legacy',
    };
  }
  
  // Endurance activities with HR data → HR-TSS
  if (sessionType === 'endurance' && avgHr && avgHr > 0) {
    return {
      tssFinal: calculateHrTss(durationMin, avgHr, lthr),
      tssVersion: 'v2_hybrid',
      sessionType: 'endurance',
      lthrUsed: lthr,
    };
  }
  
  // Strength training → RPE-TSS with validation factor
  if (sessionType === 'strength') {
    return {
      tssFinal: calculateRpeTss(durationMin, rpe, validated),
      tssVersion: 'v2_hybrid',
      sessionType: 'strength',
    };
  }
  
  // Legacy fallback (endurance without HR, or unknown types) → subjective TSS
  return {
    tssFinal: calculateTssSubjective(durationMin, rpe),
    tssVersion: 'v1_rpe',
    sessionType: 'legacy',
  };
}

export function getHRVBaseline7d(date: string, dailyChecks: DailyCheck[]): number {
  const targetDate = new Date(date);
  const last7Days: number[] = [];
  
  for (let i = 1; i <= 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const check = dailyChecks.find(c => c.date === checkDate);
    // Filtrar apenas valores de HRV válidos (> 0)
    if (check?.hrv && check.hrv > 0) {
      last7Days.push(check.hrv);
    }
  }
  
  if (last7Days.length === 0) return 0;
  return Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);
}

export function getHRVStatus(currentHrv: number, baseline: number): HRVStatus {
  if (baseline === 0 || currentHrv >= baseline) return 'OK';
  if (currentHrv >= baseline * 0.9) return 'Alert';
  return 'Critical';
}

export function getHRVFactor(status: HRVStatus): number {
  switch (status) {
    case 'OK': return 1.0;
    case 'Alert': return 0.7;
    case 'Critical': return 0.4;
  }
}

export function getHRVMetrics(date: string, dailyChecks: DailyCheck[]): HRVMetrics | null {
  const check = dailyChecks.find(c => c.date === date);
  
  if (!check) return null;
  
  const baseline = getHRVBaseline7d(date, dailyChecks);
  const status = getHRVStatus(check.hrv, baseline);
  const factor = getHRVFactor(status);
  
  return {
    baseline7d: baseline,
    currentHrv: check.hrv,
    status,
    factor,
  };
}

/**
 * Get total TSS for a given date
 * TSS v2: Uses tssFinal directly (immutable at save time)
 * HRV factor is NO LONGER applied here - TSS is locked when saved
 * Falls back to tssSubjective for legacy workouts without tssFinal
 */
export function getDailyTssEffective(date: string, workouts: Workout[]): number {
  const dateWorkouts = workouts.filter(w => w.date === date);
  // Use tssFinal if available, otherwise fall back to tssSubjective for legacy data
  const totalTss = dateWorkouts.reduce((sum, w) => sum + (w.tssFinal ?? w.tssSubjective), 0);
  return Math.round(totalTss);
}

/**
 * Calculate Acute Training Load (ATL) - 7-day rolling average
 * TSS v2: Uses tssFinal directly, no HRV factor
 */
export function calculateATL(date: string, workouts: Workout[]): number {
  const targetDate = new Date(date);
  let totalTss = 0;
  
  for (let i = 0; i < 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const tss = getDailyTssEffective(checkDate, workouts);
    totalTss += tss;
  }
  
  return Math.round(totalTss / 7);
}

/**
 * Calculate Chronic Training Load (CTL) - 42-day exponential moving average
 * TSS v2: Uses tssFinal directly, no HRV factor
 */
export function calculateCTL(date: string, workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  
  const targetDate = new Date(date);
  const alpha = 2 / (42 + 1); // EMA decay factor
  
  // Get all unique workout dates
  const allDates = new Set(workouts.map(w => w.date));
  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return 0;
  
  // Initialize CTL with first week average
  const firstWeekDates = sortedDates.slice(0, 7);
  let ctl = firstWeekDates.reduce((sum, d) => sum + getDailyTssEffective(d, workouts), 0) / Math.max(firstWeekDates.length, 1);
  
  // Calculate EMA up to target date
  for (const dateStr of sortedDates) {
    if (new Date(dateStr) > targetDate) break;
    const tss = getDailyTssEffective(dateStr, workouts);
    ctl = alpha * tss + (1 - alpha) * ctl;
  }
  
  return Math.round(ctl);
}

export function getTodayMetrics(dailyChecks: DailyCheck[], workouts: Workout[]): TodayMetrics {
  const today = format(new Date(), 'yyyy-MM-dd');
  const check = dailyChecks.find(c => c.date === today);
  const hrvMetrics = getHRVMetrics(today, dailyChecks);
  
  const hrv = check?.hrv ?? 0;
  const baseline = hrvMetrics?.baseline7d ?? 0;
  const status = hrvMetrics?.status ?? 'OK';
  const factor = hrvMetrics?.factor ?? 1.0;
  
  // TSS v2: CTL/ATL use tssFinal directly
  const ctl = calculateCTL(today, workouts);
  const atl = calculateATL(today, workouts);
  const tsb = ctl - atl;
  
  // Determine recommendation
  let recommendation: 'maintain' | 'reduce' | 'rest' = 'maintain';
  let alert: string | undefined;
  
  if (tsb < -15) {
    recommendation = 'rest';
    alert = 'TSB muito baixo. Risco de overreaching.';
  } else if (status === 'Critical') {
    recommendation = 'rest';
    alert = 'HRV crítico. Priorize recuperação.';
  } else if (status === 'Alert' || tsb < -5) {
    recommendation = 'reduce';
  }
  
  // Check consecutive critical days
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayHrv = getHRVMetrics(yesterday, dailyChecks);
  
  if (status === 'Critical' && yesterdayHrv?.status === 'Critical') {
    alert = 'HRV crítico por 2+ dias. Descanse!';
    recommendation = 'rest';
  }
  
  return {
    hrv,
    hrvBaseline: baseline,
    hrvStatus: status,
    hrvFactor: factor,
    ctl,
    atl,
    tsb,
    recommendation,
    alert,
  };
}

export function getWeeklyLoad(weekOffset: number, workouts: Workout[]): WeeklyLoad {
  const targetDate = subDays(new Date(), weekOffset * 7);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  
  const weekId = `${getYear(weekStart)}-W${String(getISOWeek(weekStart)).padStart(2, '0')}`;
  
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weeklyTss = days.reduce((sum, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return sum + getDailyTssEffective(dateStr, workouts);
  }, 0);
  
  const lastDay = format(weekEnd, 'yyyy-MM-dd');
  const atl = calculateATL(lastDay, workouts);
  const ctl = calculateCTL(lastDay, workouts);
  const tsb = ctl - atl;
  
  return {
    weekId,
    weeklyTss,
    atl,
    ctl,
    tsb,
  };
}

export function getWeeklyHistory(weeks: number, workouts: Workout[]): WeeklyLoad[] {
  const history: WeeklyLoad[] = [];
  
  for (let i = 0; i < weeks; i++) {
    history.push(getWeeklyLoad(i, workouts));
  }
  
  return history;
}

export interface DailyTrendData {
  date: string;        // 'dd/MM'
  fullDate: string;    // 'yyyy-MM-dd'
  hrv: number | null;
  hrvBaseline: number;
  tsb: number;
}

export function get14DayTrend(dailyChecks: DailyCheck[], workouts: Workout[]): DailyTrendData[] {
  const today = new Date();
  const trend: DailyTrendData[] = [];
  
  for (let i = 13; i >= 0; i--) {
    const targetDate = subDays(today, i);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const displayDate = format(targetDate, 'dd/MM');
    
    const check = dailyChecks.find(c => c.date === dateStr);
    const baseline = getHRVBaseline7d(dateStr, dailyChecks);
    // TSS v2: CTL/ATL use tssFinal directly
    const ctl = calculateCTL(dateStr, workouts);
    const atl = calculateATL(dateStr, workouts);
    const tsb = ctl - atl;
    
    trend.push({
      date: displayDate,
      fullDate: dateStr,
      hrv: check?.hrv ?? null,
      hrvBaseline: baseline,
      tsb,
    });
  }
  
  return trend;
}
