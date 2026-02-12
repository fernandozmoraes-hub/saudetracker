import { BodyCompositionEntry, MuscleIntegrityStatus } from '@/types/health';
import { Workout } from '@/types/health';

// Linear regression helper
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// 7-day moving average (excludes flagged entries)
export function movingAverage7d(
  entries: BodyCompositionEntry[],
  field: 'weightKg' | 'muscleMassKg' | 'bodyFatPct',
  targetDate: string
): number | null {
  const target = new Date(targetDate).getTime();
  const sevenDaysAgo = target - 7 * 24 * 60 * 60 * 1000;

  const relevant = entries.filter(e => {
    if (e.flaggedInconsistent) return false;
    const d = new Date(e.date).getTime();
    return d > sevenDaysAgo && d <= target;
  });

  if (relevant.length === 0) return null;
  const sum = relevant.reduce((s, e) => s + e[field], 0);
  return sum / relevant.length;
}

// 30-day trend with linear regression
export interface Trend30d {
  absoluteChange: number;
  percentChange: number;
  slope: number;
}

export function calculateTrend30d(
  entries: BodyCompositionEntry[],
  field: 'weightKg' | 'muscleMassKg' | 'bodyFatPct'
): Trend30d | null {
  const filtered = entries.filter(e => !e.flaggedInconsistent);
  if (filtered.length < 2) return null;

  const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = new Date().getTime();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recent = sorted.filter(e => new Date(e.date).getTime() >= thirtyDaysAgo);

  if (recent.length < 2) return null;

  const baseDate = new Date(recent[0].date).getTime();
  const points = recent.map(e => ({
    x: (new Date(e.date).getTime() - baseDate) / (24 * 60 * 60 * 1000),
    y: e[field],
  }));

  const { slope } = linearRegression(points);
  const first = recent[0][field];
  const last = recent[recent.length - 1][field];
  const absoluteChange = last - first;
  const percentChange = first !== 0 ? (absoluteChange / first) * 100 : 0;

  return { absoluteChange, percentChange, slope };
}

// Muscle integrity status classification
export function getMuscleIntegrityStatus(
  trend30d: Trend30d | null,
  entries60d?: BodyCompositionEntry[]
): MuscleIntegrityStatus {
  if (!trend30d) return 'preserved';

  const pct = trend30d.percentChange;

  // Check 60-day continuous decline
  if (entries60d && entries60d.length >= 4) {
    const filtered = entries60d.filter(e => !e.flaggedInconsistent)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (filtered.length >= 4) {
      const baseDate = new Date(filtered[0].date).getTime();
      const points60 = filtered.map(e => ({
        x: (new Date(e.date).getTime() - baseDate) / (24 * 60 * 60 * 1000),
        y: e.muscleMassKg,
      }));
      const { slope } = linearRegression(points60);
      if (slope < 0) return 'at_risk';
    }
  }

  // Ignore variations < 0.5%
  if (Math.abs(pct) < 0.5) return 'preserved';
  if (pct < -2) return 'at_risk';
  if (pct < -1) return 'declining';
  return 'preserved';
}

// Training correlation for the agent
export interface TrainingCorrelation {
  weeklyVolumeKm: number;
  strengthFrequency: number;
  avgIntensity: number;
  weeklyTss: number;
}

export function getTrainingCorrelation(
  workouts: Workout[],
  days: number = 30
): TrainingCorrelation {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recent = workouts.filter(w => w.date >= cutoffStr);
  const weeks = days / 7;

  const totalKm = recent.reduce((s, w) => s + (w.distanceKm || 0), 0);
  const strengthCount = recent.filter(w => w.type === 'Strength').length;
  const rpeValues = recent.filter(w => w.rpe > 0).map(w => w.rpe);
  const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length : 0;
  const totalTss = recent.reduce((s, w) => s + (w.tssFinal || w.tssSubjective || 0), 0);

  return {
    weeklyVolumeKm: totalKm / weeks,
    strengthFrequency: strengthCount,
    avgIntensity: Math.round(avgRpe * 10) / 10,
    weeklyTss: totalTss / weeks,
  };
}

// Muscle Integrity Index
export function calculateMuscleIntegrityIndex(
  currentLeanMassRatio: number,
  trend30d: Trend30d | null,
  weeklyTss: number
): number {
  const base = currentLeanMassRatio * 100;
  const trendFactor = trend30d ? trend30d.percentChange * 2 : 0;
  const loadPenalty = weeklyTss > 400 ? (weeklyTss - 400) * 0.01 : 0;
  return Math.max(0, Math.min(100, base + trendFactor - loadPenalty));
}
