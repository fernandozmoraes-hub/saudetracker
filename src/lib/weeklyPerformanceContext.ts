import { format, subDays, differenceInCalendarDays } from 'date-fns';
import {
  DailyCheck,
  Workout,
  BodyCompositionEntry,
  AlcoholIntakeEntry,
  Equipment,
} from '@/types/health';
import { calculateATL, calculateCTL } from '@/lib/calculations';
import { getDailyTotal, getAlcoholHRVCorrelation } from '@/lib/alcoholCalcs';

// ────────────────────────────────────────────────────────────
// Weekly Performance Context — agregação somente (sem novos cálculos).
// Cada bloco devolve { available: true, ... } ou
// { available: false, reason: 'insufficient_data' | 'no_data' }.
// ────────────────────────────────────────────────────────────

export interface BlockUnavailable {
  available: false;
  reason: 'insufficient_data' | 'no_data';
}

export interface RecoveryBlock {
  available: true;
  daysWithData: number;
  avgHrv: number | null;
  hrvBaseline7d: number | null;
  hrvVsBaselinePct: number | null;
  avgRestingHr: number | null;
  avgBodyBattery: number | null;
  avgSleepHours: number | null;
  avgSleepQuality: number | null;
  flags: string[];
}

export interface LoadBlock {
  available: true;
  totalTss: number;
  workoutCount: number;
  totalVolumeMin: number;
  totalDistanceKm: number;
  ctlStart: number;
  ctlEnd: number;
  atlStart: number;
  atlEnd: number;
  tsbStart: number;
  tsbEnd: number;
}

export interface WorkoutsBlock {
  available: true;
  strengthCount: number;
  enduranceCount: number;
  totalDurationMin: number;
  avgRpe: number | null;
  highlights: Array<{
    date: string;
    type: string;
    durationMin: number;
    rpe: number;
    tss: number;
    distanceKm: number | null;
  }>;
}

export interface AlcoholBlock {
  available: true;
  totalGrams: number;
  daysWithAlcohol: number;
  weeklyAvgGrams: number;
  correlation: {
    available: boolean;
    r?: number;
    classification?: string;
    label?: string;
    sampleSize?: number;
  };
}

export interface BodyCompositionBlock {
  available: true;
  latest: { date: string; weightKg: number; muscleMassKg: number; bodyFatPct: number };
  trend?: {
    spanDays: number;
    weightDeltaKg: number;
    muscleDeltaKg: number;
    bodyFatDeltaPct: number;
  };
}

export interface EquipmentBlock {
  available: true;
  items: Array<{
    name: string;
    brand: string | null;
    totalKm: number;
    maxKm: number;
    wearPct: number;
    status: string;
    usedThisWeek: boolean;
  }>;
}

export type BlockKey =
  | 'recovery'
  | 'load'
  | 'workouts'
  | 'alcohol'
  | 'bodyComposition'
  | 'equipment';

export interface WeeklyPerformanceContext {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  dataCoverage: Record<BlockKey, boolean>;
  recovery: RecoveryBlock | BlockUnavailable;
  load: LoadBlock | BlockUnavailable;
  workouts: WorkoutsBlock | BlockUnavailable;
  alcohol: AlcoholBlock | BlockUnavailable;
  bodyComposition: BodyCompositionBlock | BlockUnavailable;
  equipment: EquipmentBlock | BlockUnavailable;
}

interface BuildInput {
  dailyChecks: DailyCheck[];
  workouts: Workout[];
  alcoholEntries: AlcoholIntakeEntry[];
  bodyComposition: BodyCompositionEntry[];
  equipment: Equipment[];
  referenceDate?: Date;
}

const avg = (arr: number[]): number | null =>
  arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

function buildRecovery(
  checks: DailyCheck[],
  allChecks: DailyCheck[],
  periodEnd: string
): RecoveryBlock | BlockUnavailable {
  if (checks.length < 3) {
    return { available: false, reason: 'insufficient_data' };
  }

  const hrv = checks.filter(c => c.hrv > 0).map(c => c.hrv);
  const rhr = checks.filter(c => c.restingHr > 0).map(c => c.restingHr);
  const sleep = checks.filter(c => c.sleepHours > 0).map(c => c.sleepHours);
  const quality = checks.filter(c => c.sleepQuality > 0).map(c => c.sleepQuality);
  const battery = checks
    .filter(c => typeof c.bodyBattery === 'number' && (c.bodyBattery as number) > 0)
    .map(c => c.bodyBattery as number);

  const baselineWindowEnd = format(subDays(new Date(periodEnd), 7), 'yyyy-MM-dd');
  const baselineWindowStart = format(subDays(new Date(periodEnd), 13), 'yyyy-MM-dd');
  const baselineHrv = allChecks
    .filter(c => c.date >= baselineWindowStart && c.date <= baselineWindowEnd && c.hrv > 0)
    .map(c => c.hrv);
  const baseline = baselineHrv.length >= 3 ? avg(baselineHrv) : null;

  const avgHrv = avg(hrv);
  const hrvVsBaselinePct =
    baseline && baseline > 0 && avgHrv && avgHrv > 0
      ? Math.round(((avgHrv - baseline) / baseline) * 1000) / 10
      : null;

  const sleepAvg = avg(sleep);
  const qualAvg = avg(quality);

  const flags: string[] = [];
  if (hrvVsBaselinePct !== null && hrvVsBaselinePct < -10) flags.push('HRV abaixo da baseline');
  if (sleepAvg !== null && sleepAvg < 6.5) flags.push('Sono médio < 6.5h');
  if (qualAvg !== null && qualAvg < 3) flags.push('Qualidade de sono baixa');

  return {
    available: true,
    daysWithData: checks.length,
    avgHrv,
    hrvBaseline7d: baseline,
    hrvVsBaselinePct,
    avgRestingHr: avg(rhr),
    avgBodyBattery: avg(battery),
    avgSleepHours: sleepAvg,
    avgSleepQuality: qualAvg,
    flags,
  };
}

function buildLoad(
  workoutsThisWeek: Workout[],
  allWorkouts: Workout[],
  periodStart: string,
  periodEnd: string
): LoadBlock | BlockUnavailable {
  if (workoutsThisWeek.length === 0) {
    return { available: false, reason: 'no_data' };
  }

  const totalTss = workoutsThisWeek.reduce(
    (s, w) => s + (w.tssFinal ?? w.tssSubjective ?? 0),
    0
  );
  const totalVolumeMin = workoutsThisWeek.reduce((s, w) => s + (w.durationMin || 0), 0);
  const totalDistanceKm = workoutsThisWeek.reduce((s, w) => s + (w.distanceKm || 0), 0);

  const ctlStart = calculateCTL(periodStart, allWorkouts);
  const ctlEnd = calculateCTL(periodEnd, allWorkouts);
  const atlStart = calculateATL(periodStart, allWorkouts);
  const atlEnd = calculateATL(periodEnd, allWorkouts);

  return {
    available: true,
    totalTss: Math.round(totalTss),
    workoutCount: workoutsThisWeek.length,
    totalVolumeMin: Math.round(totalVolumeMin),
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    ctlStart: Math.round(ctlStart * 10) / 10,
    ctlEnd: Math.round(ctlEnd * 10) / 10,
    atlStart: Math.round(atlStart * 10) / 10,
    atlEnd: Math.round(atlEnd * 10) / 10,
    tsbStart: Math.round((ctlStart - atlStart) * 10) / 10,
    tsbEnd: Math.round((ctlEnd - atlEnd) * 10) / 10,
  };
}

function buildWorkouts(workoutsThisWeek: Workout[]): WorkoutsBlock | BlockUnavailable {
  if (workoutsThisWeek.length === 0) {
    return { available: false, reason: 'no_data' };
  }

  const strengthCount = workoutsThisWeek.filter(w => w.sessionType === 'strength').length;
  const enduranceCount = workoutsThisWeek.filter(w => w.sessionType === 'endurance').length;
  const totalDurationMin = workoutsThisWeek.reduce((s, w) => s + (w.durationMin || 0), 0);
  const rpes = workoutsThisWeek.filter(w => w.rpe > 0).map(w => w.rpe);

  const highlights = [...workoutsThisWeek]
    .sort((a, b) => (b.tssFinal ?? 0) - (a.tssFinal ?? 0))
    .slice(0, 5)
    .map(w => ({
      date: w.date,
      type: w.type,
      durationMin: w.durationMin,
      rpe: w.rpe,
      tss: w.tssFinal ?? w.tssSubjective ?? 0,
      distanceKm: w.distanceKm ?? null,
    }));

  return {
    available: true,
    strengthCount,
    enduranceCount,
    totalDurationMin: Math.round(totalDurationMin),
    avgRpe: avg(rpes),
    highlights,
  };
}

function buildAlcohol(
  alcoholEntries: AlcoholIntakeEntry[],
  dailyChecks: DailyCheck[],
  referenceDate: Date
): AlcoholBlock | BlockUnavailable {
  let totalGrams = 0;
  let daysWithAlcohol = 0;
  for (let i = 0; i < 7; i++) {
    const d = format(subDays(referenceDate, i), 'yyyy-MM-dd');
    const g = getDailyTotal(alcoholEntries, d);
    if (g > 0) {
      totalGrams += g;
      daysWithAlcohol++;
    }
  }

  if (daysWithAlcohol === 0) {
    return { available: false, reason: 'no_data' };
  }

  const correlation = getAlcoholHRVCorrelation(
    alcoholEntries,
    dailyChecks.map(c => ({ date: c.date, hrv: c.hrv }))
  );

  return {
    available: true,
    totalGrams: Math.round(totalGrams * 10) / 10,
    daysWithAlcohol,
    weeklyAvgGrams: Math.round(totalGrams * 10) / 10,
    correlation: correlation
      ? {
          available: true,
          r: correlation.r,
          classification: correlation.classification,
          label: correlation.label,
          sampleSize: correlation.sampleSize,
        }
      : { available: false },
  };
}

function buildBodyComposition(
  entries: BodyCompositionEntry[],
  referenceDate: Date
): BodyCompositionBlock | BlockUnavailable {
  const consistent = entries.filter(e => !e.flaggedInconsistent);
  if (consistent.length === 0) return { available: false, reason: 'no_data' };

  const sorted = [...consistent].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latest = sorted[0];

  const last30 = consistent
    .filter(e => differenceInCalendarDays(referenceDate, new Date(e.date)) <= 30)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let trend: BodyCompositionBlock['trend'] | undefined;
  if (last30.length >= 2) {
    const first = last30[0];
    const last = last30[last30.length - 1];
    const spanDays = differenceInCalendarDays(new Date(last.date), new Date(first.date));
    if (spanDays >= 7) {
      trend = {
        spanDays,
        weightDeltaKg: Math.round((last.weightKg - first.weightKg) * 100) / 100,
        muscleDeltaKg: Math.round((last.muscleMassKg - first.muscleMassKg) * 100) / 100,
        bodyFatDeltaPct: Math.round((last.bodyFatPct - first.bodyFatPct) * 100) / 100,
      };
    }
  }

  return {
    available: true,
    latest: {
      date: latest.date,
      weightKg: latest.weightKg,
      muscleMassKg: latest.muscleMassKg,
      bodyFatPct: latest.bodyFatPct,
    },
    trend,
  };
}

function buildEquipment(
  equipment: Equipment[],
  workoutsThisWeek: Workout[]
): EquipmentBlock | BlockUnavailable {
  const active = equipment.filter(e => e.activeForSelection || e.status !== 'retired');
  if (active.length === 0) return { available: false, reason: 'no_data' };

  const usedIds = new Set(
    workoutsThisWeek.map(w => w.equipmentId).filter(Boolean) as string[]
  );

  return {
    available: true,
    items: active.map(e => ({
      name: e.name,
      brand: e.brand ?? null,
      totalKm: Math.round(e.totalKm * 10) / 10,
      maxKm: e.maxKm,
      wearPct: e.maxKm > 0 ? Math.round((e.totalKm / e.maxKm) * 1000) / 10 : 0,
      status: e.status,
      usedThisWeek: usedIds.has(e.id),
    })),
  };
}

export function buildWeeklyPerformanceContext(input: BuildInput): WeeklyPerformanceContext {
  const referenceDate = input.referenceDate ?? new Date();
  const periodEnd = format(referenceDate, 'yyyy-MM-dd');
  const periodStart = format(subDays(referenceDate, 6), 'yyyy-MM-dd');

  const checksThisWeek = input.dailyChecks.filter(
    c => c.date >= periodStart && c.date <= periodEnd
  );
  const workoutsThisWeek = input.workouts.filter(
    w => w.date >= periodStart && w.date <= periodEnd
  );

  const recovery = buildRecovery(checksThisWeek, input.dailyChecks, periodEnd);
  const load = buildLoad(workoutsThisWeek, input.workouts, periodStart, periodEnd);
  const workouts = buildWorkouts(workoutsThisWeek);
  const alcohol = buildAlcohol(input.alcoholEntries, input.dailyChecks, referenceDate);
  const bodyComposition = buildBodyComposition(input.bodyComposition, referenceDate);
  const equipment = buildEquipment(input.equipment, workoutsThisWeek);

  const blockAvailable = (b: { available?: boolean }) => Boolean(b?.available);

  return {
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    dataCoverage: {
      recovery: blockAvailable(recovery),
      load: blockAvailable(load),
      workouts: blockAvailable(workouts),
      alcohol: blockAvailable(alcohol),
      bodyComposition: blockAvailable(bodyComposition),
      equipment: blockAvailable(equipment),
    },
    recovery,
    load,
    workouts,
    alcohol,
    bodyComposition,
    equipment,
  };
}
