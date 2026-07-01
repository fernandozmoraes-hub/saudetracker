import { format, subDays, differenceInCalendarDays } from 'date-fns';
import { DailyCheck, Workout, BodyCompositionEntry, AlcoholIntakeEntry, Equipment } from '@/types/health';
import {
  getHRVMetrics,
  getHRVBaseline7d,
  calculateATL,
  calculateCTL,
} from '@/lib/calculations';
import { calculateTrend30d, movingAverage7d } from '@/lib/bodyCompositionCalcs';
import {
  getDailyTotal,
  getAlcoholHRVCorrelation,
  getWeeklyPattern,
} from '@/lib/alcoholCalcs';

// ────────────────────────────────────────────────────────────
// Performance Context — agregação somente. Sem cálculos novos.
// Cada seção retorna `null` ou `{ available: false, reason, ... }`
// quando não houver amostragem mínima, para evitar inferências do agente.
// ────────────────────────────────────────────────────────────

export type SectionKey =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'bodyComposition'
  | 'recentWorkouts'
  | 'equipment'
  | 'alcohol'
  | 'alcoholTrend';

export interface CoverageInfo {
  status: 'available' | 'unavailable';
  reason?: string;
  entries?: number;
  spanDays?: number;
  sampleSize?: number;
  eventCount?: number;
  daysWithIntake?: number;
}

export interface SectionUnavailable {
  available: false;
  reason: 'insufficient_data' | 'no_data';
  requiredDays?: number;
  foundDays?: number;
}

export interface TodaySection {
  available: true;
  date: string;
  hrv: number | null;
  hrvBaseline7d: number | null;
  hrvVsBaselinePct: number | null;
  hrvStatus: 'OK' | 'Alert' | 'Critical' | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  bodyBattery: number | null;
  ctl: number;
  atl: number;
  tsb: number;
  alcoholYesterdayGrams: number;
}

export interface Last7DaysSection {
  available: true;
  daysWithData: number;
  avgHrv: number | null;
  avgRestingHr: number | null;
  avgSleepHours: number | null;
  totalTss: number;
  workoutCount: number;
  workoutTypes: Record<string, number>;
  alcoholTotalGrams: number;
  daysWithAlcohol: number;
}

export interface Last30DaysSection {
  available: true;
  daysWithData: number;
  totalTss: number;
  enduranceCount: number;
  strengthCount: number;
  ctlSeries: { date: string; ctl: number; atl: number; tsb: number }[];
  hrvTrend: { slopePerDay: number; samples: number } | null;
  sleepTrend: { slopePerDay: number; samples: number } | null;
  alcoholTrend: { slopePerWeek: number; samples: number } | null;
}

export type TrendUnavailableReason =
  | 'no_recent_data'
  | 'insufficient_entries'
  | 'insufficient_span'
  | 'not_computable';

export type TrendValue =
  | { absoluteChange: number; percentChange: number }
  | { available: false; reason: TrendUnavailableReason };

export interface BodyCompositionSection {
  available: true;
  latest: {
    date: string;
    weightKg: number;
    muscleMassKg: number;
    bodyFatPct: number;
  };
  ma7: {
    weightKg: number | null;
    muscleMassKg: number | null;
    bodyFatPct: number | null;
  };
  trend30d: {
    weight: TrendValue;
    muscle: TrendValue;
    bodyFat: TrendValue;
    windowDays: number;
    entriesInWindow: number;
    spanDays: number;
  };
  totalEntries: number;
}

export interface RecentWorkoutItem {
  date: string;
  type: string;
  durationMin: number;
  rpe: number;
  tss: number;
  distanceKm: number | null;
  avgHr: number | null;
}

export interface EquipmentItem {
  name: string;
  brand: string | null;
  totalKm: number;
  maxKm: number;
  wearPct: number;
  status: string;
}

export interface AlcoholSection {
  available: true;
  last7Days: {
    totalGrams: number;
    daysWithIntake: number;
    eventCount: number;
  };
  last30Days: {
    totalGrams: number;
    daysWithIntake: number;
    eventCount: number;
    weeklyAvgGrams: number;
  };
  lastEventDate: string | null;
}

export interface AlcoholTrendSection {
  available: true;
  hrvImpact:
    | { available: true; r: number; classification: string; label: string; sampleSize: number }
    | { available: false; reason: 'insufficient_pairs' | 'no_data' };
  weeklyPattern:
    | { available: true; pattern: string; avgWeekly: number; trend: 'up' | 'down' | 'stable'; weeklyTotals: number[] }
    | { available: false; reason: 'insufficient_samples' };
}

export interface PerformanceContext {
  generatedAt: string;
  dataCoverage: Record<SectionKey, CoverageInfo>;
  today: TodaySection | SectionUnavailable;
  last7Days: Last7DaysSection | SectionUnavailable;
  last30Days: Last30DaysSection | SectionUnavailable;
  bodyComposition: BodyCompositionSection | SectionUnavailable;
  recentWorkouts: RecentWorkoutItem[];
  equipment: EquipmentItem[];
  alcohol: AlcoholSection | SectionUnavailable;
  alcoholTrend: AlcoholTrendSection | SectionUnavailable;
  /** @deprecated mantido por compatibilidade — use `alcohol` e `alcoholTrend`. */
  alcoholCorrelation: {
    available: boolean;
    r?: number;
    classification?: string;
    label?: string;
    sampleSize?: number;
    weeklyAvgGrams?: number;
    weeklyPattern?: string;
    weeklyTrend?: 'up' | 'down' | 'stable';
  };
}

interface BuildInput {
  dailyChecks: DailyCheck[];
  workouts: Workout[];
  bodyComposition: BodyCompositionEntry[];
  alcoholEntries: AlcoholIntakeEntry[];
  equipment: Equipment[];
}

function regressionSlope(points: { x: number; y: number }[], minSamples = 10): number | null {
  const n = points.length;
  if (n < minSamples) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

function buildToday(
  dailyChecks: DailyCheck[],
  workouts: Workout[],
  alcoholEntries: AlcoholIntakeEntry[]
): TodaySection | SectionUnavailable {
  const today = format(new Date(), 'yyyy-MM-dd');
  const check = dailyChecks.find(c => c.date === today);

  if (!check) {
    return { available: false, reason: 'no_data' };
  }

  const baseline = getHRVBaseline7d(today, dailyChecks);
  const hrvMetrics = getHRVMetrics(today, dailyChecks);
  const ctl = calculateCTL(today, workouts);
  const atl = calculateATL(today, workouts);
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const alcoholYesterdayGrams = getDailyTotal(alcoholEntries, yesterday);

  const hrvVsBaselinePct =
    baseline > 0 && check.hrv > 0 ? ((check.hrv - baseline) / baseline) * 100 : null;

  return {
    available: true,
    date: today,
    hrv: check.hrv > 0 ? check.hrv : null,
    hrvBaseline7d: baseline > 0 ? baseline : null,
    hrvVsBaselinePct: hrvVsBaselinePct !== null ? Math.round(hrvVsBaselinePct * 10) / 10 : null,
    hrvStatus: hrvMetrics?.status ?? null,
    restingHr: check.restingHr > 0 ? check.restingHr : null,
    sleepHours: check.sleepHours > 0 ? check.sleepHours : null,
    sleepQuality: check.sleepQuality > 0 ? check.sleepQuality : null,
    bodyBattery: check.bodyBattery ?? null,
    ctl,
    atl,
    tsb: ctl - atl,
    alcoholYesterdayGrams,
  };
}

function buildLast7Days(
  dailyChecks: DailyCheck[],
  workouts: Workout[],
  alcoholEntries: AlcoholIntakeEntry[]
): Last7DaysSection | SectionUnavailable {
  const today = new Date();
  const since = format(subDays(today, 6), 'yyyy-MM-dd');
  const checks = dailyChecks.filter(c => c.date >= since);

  if (checks.length < 3) {
    return { available: false, reason: 'insufficient_data', requiredDays: 3, foundDays: checks.length };
  }

  const hrvValues = checks.filter(c => c.hrv > 0).map(c => c.hrv);
  const rhrValues = checks.filter(c => c.restingHr > 0).map(c => c.restingHr);
  const sleepValues = checks.filter(c => c.sleepHours > 0).map(c => c.sleepHours);

  const recentWorkouts = workouts.filter(w => w.date >= since);
  const workoutTypes: Record<string, number> = {};
  recentWorkouts.forEach(w => {
    workoutTypes[w.type] = (workoutTypes[w.type] ?? 0) + 1;
  });
  const totalTss = recentWorkouts.reduce((s, w) => s + (w.tssFinal ?? w.tssSubjective ?? 0), 0);

  let alcoholTotalGrams = 0;
  let daysWithAlcohol = 0;
  for (let i = 0; i < 7; i++) {
    const d = format(subDays(today, i), 'yyyy-MM-dd');
    const g = getDailyTotal(alcoholEntries, d);
    if (g > 0) {
      alcoholTotalGrams += g;
      daysWithAlcohol++;
    }
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

  return {
    available: true,
    daysWithData: checks.length,
    avgHrv: avg(hrvValues),
    avgRestingHr: avg(rhrValues),
    avgSleepHours: avg(sleepValues),
    totalTss: Math.round(totalTss),
    workoutCount: recentWorkouts.length,
    workoutTypes,
    alcoholTotalGrams: Math.round(alcoholTotalGrams * 10) / 10,
    daysWithAlcohol,
  };
}

function buildLast30Days(
  dailyChecks: DailyCheck[],
  workouts: Workout[],
  alcoholEntries: AlcoholIntakeEntry[]
): Last30DaysSection | SectionUnavailable {
  const today = new Date();
  const since = format(subDays(today, 29), 'yyyy-MM-dd');
  const checks = dailyChecks.filter(c => c.date >= since);
  const recentWorkouts = workouts.filter(w => w.date >= since);

  if (checks.length === 0 && recentWorkouts.length === 0) {
    return { available: false, reason: 'no_data' };
  }

  const ctlSeries: { date: string; ctl: number; atl: number; tsb: number }[] = [];
  for (let i = 29; i >= 0; i -= 3) {
    const d = format(subDays(today, i), 'yyyy-MM-dd');
    const ctl = calculateCTL(d, workouts);
    const atl = calculateATL(d, workouts);
    ctlSeries.push({ date: d, ctl, atl, tsb: ctl - atl });
  }

  const totalTss = recentWorkouts.reduce((s, w) => s + (w.tssFinal ?? w.tssSubjective ?? 0), 0);
  const enduranceCount = recentWorkouts.filter(w => w.sessionType === 'endurance').length;
  const strengthCount = recentWorkouts.filter(w => w.sessionType === 'strength').length;

  const baseDate = subDays(today, 29);
  const hrvPoints = checks
    .filter(c => c.hrv > 0)
    .map(c => ({ x: differenceInCalendarDays(new Date(c.date), baseDate), y: c.hrv }));
  const sleepPoints = checks
    .filter(c => c.sleepHours > 0)
    .map(c => ({ x: differenceInCalendarDays(new Date(c.date), baseDate), y: c.sleepHours }));

  const hrvSlope = regressionSlope(hrvPoints, 10);
  const sleepSlope = regressionSlope(sleepPoints, 10);

  const weeklyTotals: number[] = [];
  for (let w = 0; w < 4; w++) {
    let weekTotal = 0;
    for (let d = 0; d < 7; d++) {
      weekTotal += getDailyTotal(alcoholEntries, format(subDays(today, w * 7 + d), 'yyyy-MM-dd'));
    }
    weeklyTotals.push(weekTotal);
  }
  const weeksWithData = weeklyTotals.filter(v => v > 0).length;
  let alcoholTrend: Last30DaysSection['alcoholTrend'] = null;
  if (weeksWithData >= 3) {
    const points = weeklyTotals.map((y, i) => ({ x: -i, y }));
    const slope = regressionSlope(points, 3);
    if (slope !== null) {
      alcoholTrend = { slopePerWeek: Math.round(slope * 10) / 10, samples: weeksWithData };
    }
  }

  return {
    available: true,
    daysWithData: checks.length,
    totalTss: Math.round(totalTss),
    enduranceCount,
    strengthCount,
    ctlSeries,
    hrvTrend:
      hrvSlope !== null
        ? { slopePerDay: Math.round(hrvSlope * 100) / 100, samples: hrvPoints.length }
        : null,
    sleepTrend:
      sleepSlope !== null
        ? { slopePerDay: Math.round(sleepSlope * 1000) / 1000, samples: sleepPoints.length }
        : null,
    alcoholTrend,
  };
}

function buildBodyComposition(
  entries: BodyCompositionEntry[]
): BodyCompositionSection | SectionUnavailable {
  const consistent = entries.filter(e => !e.flaggedInconsistent);
  if (consistent.length === 0) return { available: false, reason: 'no_data' };

  const sorted = [...consistent].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latest = sorted[0];
  const today = format(new Date(), 'yyyy-MM-dd');

  const last30 = consistent
    .filter(e => differenceInCalendarDays(new Date(today), new Date(e.date)) <= 30)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const span = last30.length >= 2
    ? differenceInCalendarDays(new Date(last30[last30.length - 1].date), new Date(last30[0].date))
    : 0;
  const trendEligible = last30.length >= 2 && span >= 14;

  const unavailableReason: TrendUnavailableReason =
    last30.length === 0
      ? 'no_recent_data'
      : last30.length < 2
      ? 'insufficient_entries'
      : span < 14
      ? 'insufficient_span'
      : 'not_computable';

  const trendFor = (field: 'weightKg' | 'muscleMassKg' | 'bodyFatPct'): TrendValue => {
    if (!trendEligible) return { available: false, reason: unavailableReason };
    const t = calculateTrend30d(consistent, field);
    if (!t) return { available: false, reason: 'not_computable' };
    return {
      absoluteChange: Math.round(t.absoluteChange * 100) / 100,
      percentChange: Math.round(t.percentChange * 100) / 100,
    };
  };

  const ma7For = (field: 'weightKg' | 'muscleMassKg' | 'bodyFatPct') => {
    const v = movingAverage7d(consistent, field, today);
    return v !== null ? Math.round(v * 100) / 100 : null;
  };

  return {
    available: true,
    latest: {
      date: latest.date,
      weightKg: latest.weightKg,
      muscleMassKg: latest.muscleMassKg,
      bodyFatPct: latest.bodyFatPct,
    },
    ma7: {
      weightKg: ma7For('weightKg'),
      muscleMassKg: ma7For('muscleMassKg'),
      bodyFatPct: ma7For('bodyFatPct'),
    },
    trend30d: {
      weight: trendFor('weightKg'),
      muscle: trendFor('muscleMassKg'),
      bodyFat: trendFor('bodyFatPct'),
      windowDays: 30,
      entriesInWindow: last30.length,
      spanDays: span,
    },
    totalEntries: consistent.length,
  };
}

function buildRecentWorkouts(workouts: Workout[]): RecentWorkoutItem[] {
  return [...workouts]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10)
    .map(w => ({
      date: w.date,
      type: w.type,
      durationMin: w.durationMin,
      rpe: w.rpe,
      tss: w.tssFinal ?? w.tssSubjective ?? 0,
      distanceKm: w.distanceKm ?? null,
      avgHr: w.avgHr ?? null,
    }));
}

function buildEquipment(equipment: Equipment[]): EquipmentItem[] {
  return equipment
    .filter(e => e.activeForSelection || e.status !== 'retired')
    .map(e => ({
      name: e.name,
      brand: e.brand ?? null,
      totalKm: Math.round(e.totalKm * 10) / 10,
      maxKm: e.maxKm,
      wearPct: e.maxKm > 0 ? Math.round((e.totalKm / e.maxKm) * 1000) / 10 : 0,
      status: e.status,
    }));
}

function buildAlcoholCorrelation(
  alcoholEntries: AlcoholIntakeEntry[],
  dailyChecks: DailyCheck[]
): PerformanceContext['alcoholCorrelation'] {
  const correlation = getAlcoholHRVCorrelation(
    alcoholEntries,
    dailyChecks.map(c => ({ date: c.date, hrv: c.hrv }))
  );
  const pattern = getWeeklyPattern(alcoholEntries);

  if (!correlation) {
    return {
      available: false,
      weeklyAvgGrams: pattern.avgWeekly,
      weeklyPattern: pattern.pattern,
      weeklyTrend: pattern.trend,
    };
  }

  return {
    available: true,
    r: correlation.r,
    classification: correlation.classification,
    label: correlation.label,
    sampleSize: correlation.sampleSize,
    weeklyAvgGrams: pattern.avgWeekly,
    weeklyPattern: pattern.pattern,
    weeklyTrend: pattern.trend,
  };
}

function buildAlcohol(entries: AlcoholIntakeEntry[]): AlcoholSection | SectionUnavailable {
  if (!entries || entries.length === 0) {
    return { available: false, reason: 'no_data' };
  }
  const now = new Date();
  const since7 = format(subDays(now, 6), 'yyyy-MM-dd');
  const since30 = format(subDays(now, 29), 'yyyy-MM-dd');

  const in7 = entries.filter(e => e.date >= since7);
  const in30 = entries.filter(e => e.date >= since30);

  const sumGrams = (arr: AlcoholIntakeEntry[]) =>
    Math.round(arr.reduce((s, e) => s + (e.alcoholGrams ?? 0), 0) * 10) / 10;
  const uniqueDays = (arr: AlcoholIntakeEntry[]) => new Set(arr.map(e => e.date)).size;

  const total30 = sumGrams(in30);
  const lastEventDate = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date ?? null;

  return {
    available: true,
    last7Days: {
      totalGrams: sumGrams(in7),
      daysWithIntake: uniqueDays(in7),
      eventCount: in7.length,
    },
    last30Days: {
      totalGrams: total30,
      daysWithIntake: uniqueDays(in30),
      eventCount: in30.length,
      weeklyAvgGrams: Math.round((total30 / 30) * 7 * 10) / 10,
    },
    lastEventDate,
  };
}

function buildAlcoholTrend(
  alcoholEntries: AlcoholIntakeEntry[],
  dailyChecks: DailyCheck[]
): AlcoholTrendSection | SectionUnavailable {
  if (!alcoholEntries || alcoholEntries.length === 0) {
    return { available: false, reason: 'no_data' };
  }
  const correlation = getAlcoholHRVCorrelation(
    alcoholEntries,
    dailyChecks.map(c => ({ date: c.date, hrv: c.hrv }))
  );
  const pattern = getWeeklyPattern(alcoholEntries);
  const hasPattern = pattern.weeklyTotals.some(v => v > 0);

  return {
    available: true,
    hrvImpact: correlation
      ? {
          available: true,
          r: correlation.r,
          classification: correlation.classification,
          label: correlation.label,
          sampleSize: correlation.sampleSize,
        }
      : { available: false, reason: 'insufficient_pairs' },
    weeklyPattern: hasPattern
      ? {
          available: true,
          pattern: pattern.pattern,
          avgWeekly: pattern.avgWeekly,
          trend: pattern.trend,
          weeklyTotals: pattern.weeklyTotals,
        }
      : { available: false, reason: 'insufficient_samples' },
  };
}

export function buildPerformanceContext(input: BuildInput): PerformanceContext {
  const today = buildToday(input.dailyChecks, input.workouts, input.alcoholEntries);
  const last7Days = buildLast7Days(input.dailyChecks, input.workouts, input.alcoholEntries);
  const last30Days = buildLast30Days(input.dailyChecks, input.workouts, input.alcoholEntries);
  const bodyComposition = buildBodyComposition(input.bodyComposition);
  const recentWorkouts = buildRecentWorkouts(input.workouts);
  const equipment = buildEquipment(input.equipment);
  const alcohol = buildAlcohol(input.alcoholEntries);
  const alcoholTrend = buildAlcoholTrend(input.alcoholEntries, input.dailyChecks);
  const alcoholCorrelation = buildAlcoholCorrelation(input.alcoholEntries, input.dailyChecks);

  const isAvailable = (s: unknown): boolean =>
    !!(s && typeof s === 'object' && (s as any).available === true);

  const dataCoverage: Record<SectionKey, CoverageInfo> = {
    today: { status: isAvailable(today) ? 'available' : 'unavailable' },
    last7Days: { status: isAvailable(last7Days) ? 'available' : 'unavailable' },
    last30Days: { status: isAvailable(last30Days) ? 'available' : 'unavailable' },
    bodyComposition: isAvailable(bodyComposition)
      ? {
          status: 'available',
          entries: (bodyComposition as BodyCompositionSection).trend30d.entriesInWindow,
          spanDays: (bodyComposition as BodyCompositionSection).trend30d.spanDays,
          reason:
            'weight' in (bodyComposition as BodyCompositionSection).trend30d &&
            (bodyComposition as BodyCompositionSection).trend30d.weight &&
            (bodyComposition as any).trend30d.weight.available === false
              ? (bodyComposition as any).trend30d.weight.reason
              : undefined,
        }
      : { status: 'unavailable', reason: (bodyComposition as SectionUnavailable).reason },
    recentWorkouts: {
      status: recentWorkouts.length > 0 ? 'available' : 'unavailable',
      entries: recentWorkouts.length,
    },
    equipment: {
      status: equipment.length > 0 ? 'available' : 'unavailable',
      entries: equipment.length,
    },
    alcohol: isAvailable(alcohol)
      ? {
          status: 'available',
          eventCount: (alcohol as AlcoholSection).last30Days.eventCount,
          daysWithIntake: (alcohol as AlcoholSection).last30Days.daysWithIntake,
        }
      : { status: 'unavailable', reason: (alcohol as SectionUnavailable).reason },
    alcoholTrend: isAvailable(alcoholTrend)
      ? {
          status: 'available',
          sampleSize:
            (alcoholTrend as AlcoholTrendSection).hrvImpact.available
              ? (alcoholTrend as any).hrvImpact.sampleSize
              : 0,
        }
      : { status: 'unavailable', reason: (alcoholTrend as SectionUnavailable).reason },
  };

  return {
    generatedAt: new Date().toISOString(),
    dataCoverage,
    today,
    last7Days,
    last30Days,
    bodyComposition,
    recentWorkouts,
    equipment,
    alcohol,
    alcoholTrend,
    alcoholCorrelation,
  };
}

export function getCoverageWarnings(ctx: PerformanceContext): string[] {
  const warnings: string[] = [];
  if (ctx.dataCoverage.today.status === 'unavailable') {
    warnings.push('Sem check-in de hoje — métricas do dia indisponíveis.');
  }
  if (ctx.dataCoverage.last7Days.status === 'unavailable') {
    warnings.push('Menos de 3 dias com check-in nos últimos 7 dias.');
  }
  if (ctx.dataCoverage.last30Days.status === 'unavailable') {
    warnings.push('Sem dados suficientes nos últimos 30 dias para análise de tendência.');
  }
  if (ctx.dataCoverage.bodyComposition.status === 'unavailable') {
    warnings.push('Sem medições de composição corporal — análise corporal limitada.');
  }
  return warnings;
}

