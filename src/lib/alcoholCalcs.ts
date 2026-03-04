import { AlcoholImpact, AlcoholIntakeEntry, DrinkType } from '@/types/health';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

export function calculateAlcoholGrams(volumeMl: number, numDrinks: number, abvPercent: number): number {
  return Math.round(volumeMl * numDrinks * (abvPercent / 100) * 0.789 * 10) / 10;
}

export function getDefaultAbv(drinkType: DrinkType): number {
  return drinkType === 'beer' ? 5 : 12;
}

export function getDailyTotal(entries: AlcoholIntakeEntry[], date: string): number {
  return entries
    .filter(e => e.date === date)
    .reduce((sum, e) => sum + e.alcoholGrams, 0);
}

export function getAlcoholImpact(grams: number): AlcoholImpact {
  if (grams === 0) return 'none';
  if (grams <= 20) return 'light';
  if (grams <= 40) return 'moderate';
  if (grams <= 60) return 'high';
  return 'very_high';
}

export function getImpactLabel(impact: AlcoholImpact): string {
  switch (impact) {
    case 'none': return 'Sem impacto';
    case 'light': return 'Leve';
    case 'moderate': return 'Moderado';
    case 'high': return 'Alto';
    case 'very_high': return 'Muito Alto';
  }
}

export function getImpactColor(impact: AlcoholImpact): string {
  switch (impact) {
    case 'none': return 'text-green-500';
    case 'light': return 'text-green-400';
    case 'moderate': return 'text-yellow-500';
    case 'high': return 'text-orange-500';
    case 'very_high': return 'text-red-500';
  }
}

export function getImpactBgColor(impact: AlcoholImpact): string {
  switch (impact) {
    case 'none': return 'bg-green-500/10';
    case 'light': return 'bg-green-400/10';
    case 'moderate': return 'bg-yellow-500/10';
    case 'high': return 'bg-orange-500/10';
    case 'very_high': return 'bg-red-500/10';
  }
}

export function getWeeklyStats(entries: AlcoholIntakeEntry[]) {
  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const weekEntries = entries.filter(e => e.date >= weekStart && e.date <= weekEnd);
  const weeklyTotal = weekEntries.reduce((sum, e) => sum + e.alcoholGrams, 0);
  const dailyAverage = Math.round((weeklyTotal / 7) * 10) / 10;

  // Consecutive days without consumption (counting backwards from today)
  let consecutiveDryDays = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = format(subDays(today, i), 'yyyy-MM-dd');
    const dayTotal = getDailyTotal(entries, checkDate);
    if (dayTotal === 0) {
      consecutiveDryDays++;
    } else {
      break;
    }
  }

  const weeklyImpact = getAlcoholImpact(dailyAverage);

  return { weeklyTotal, dailyAverage, consecutiveDryDays, weeklyImpact };
}

export function getAlcoholFlag(previousDayGrams: number): string | null {
  if (previousDayGrams > 60) return '🔴 Alto Impacto Fisiológico';
  if (previousDayGrams > 40) return '⚠ Recuperação Comprometida';
  return null;
}

export function getConsecutiveDrinkingDays(entries: AlcoholIntakeEntry[]): number {
  const today = new Date();
  let count = 0;
  for (let i = 1; i <= 30; i++) {
    const checkDate = format(subDays(today, i), 'yyyy-MM-dd');
    const dayTotal = getDailyTotal(entries, checkDate);
    if (dayTotal > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ── Correlation & Pattern Analysis ──

export function calculateDeltaHRV(hrv: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return ((hrv - baseline) / baseline) * 100;
}

export function calculatePearsonCorrelation(pairs: { x: number; y: number }[]): number {
  const n = pairs.length;
  if (n < 2) return 0;

  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export type CorrelationClassification =
  | 'none'
  | 'light_negative'
  | 'moderate_negative'
  | 'strong_negative';

export function classifyCorrelation(r: number): CorrelationClassification {
  if (r <= -0.6) return 'strong_negative';
  if (r <= -0.4) return 'moderate_negative';
  if (r <= -0.2) return 'light_negative';
  return 'none';
}

export function getCorrelationLabel(c: CorrelationClassification): string {
  switch (c) {
    case 'none': return 'Sem correlação relevante';
    case 'light_negative': return 'Correlação negativa leve';
    case 'moderate_negative': return 'Correlação negativa moderada';
    case 'strong_negative': return 'Correlação negativa forte';
  }
}

export function getCorrelationColor(c: CorrelationClassification): string {
  switch (c) {
    case 'none': return 'text-green-500';
    case 'light_negative': return 'text-yellow-500';
    case 'moderate_negative': return 'text-orange-500';
    case 'strong_negative': return 'text-red-500';
  }
}

export function getCorrelationBgColor(c: CorrelationClassification): string {
  switch (c) {
    case 'none': return 'bg-green-500/10';
    case 'light_negative': return 'bg-yellow-500/10';
    case 'moderate_negative': return 'bg-orange-500/10';
    case 'strong_negative': return 'bg-red-500/10';
  }
}

interface DailyCheckForCorrelation {
  date: string;
  hrv: number;
}

export interface CorrelationResult {
  r: number;
  classification: CorrelationClassification;
  label: string;
  sampleSize: number;
  pairs: { x: number; y: number; date: string }[];
}

export function getAlcoholHRVCorrelation(
  alcoholEntries: AlcoholIntakeEntry[],
  dailyChecks: DailyCheckForCorrelation[]
): CorrelationResult | null {
  const today = new Date();
  const thirtyDaysAgo = format(subDays(today, 30), 'yyyy-MM-dd');

  // Get dates with alcohol consumption > 0 in last 30 days
  const dateGramsMap: Record<string, number> = {};
  alcoholEntries.forEach(e => {
    if (e.date >= thirtyDaysAgo) {
      dateGramsMap[e.date] = (dateGramsMap[e.date] || 0) + e.alcoholGrams;
    }
  });

  // Build HRV map and compute 7-day baselines
  const hrvMap: Record<string, number> = {};
  dailyChecks.forEach(c => { hrvMap[c.date] = c.hrv; });

  const pairs: { x: number; y: number; date: string }[] = [];

  Object.entries(dateGramsMap).forEach(([alcoholDate, grams]) => {
    if (grams <= 0) return;
    // Next day HRV
    const nextDay = format(subDays(new Date(alcoholDate + 'T12:00:00'), -1), 'yyyy-MM-dd');
    const nextDayHRV = hrvMap[nextDay];
    if (nextDayHRV === undefined) return;

    // Compute 7-day baseline ending day before alcohol date
    let sum = 0, count = 0;
    for (let i = 1; i <= 7; i++) {
      const d = format(subDays(new Date(alcoholDate + 'T12:00:00'), i), 'yyyy-MM-dd');
      if (hrvMap[d] !== undefined) { sum += hrvMap[d]; count++; }
    }
    if (count < 3) return; // Need at least 3 days for baseline
    const baseline = sum / count;
    const deltaHRV = calculateDeltaHRV(nextDayHRV, baseline);

    pairs.push({ x: grams, y: deltaHRV, date: alcoholDate });
  });

  if (pairs.length < 10) return null;

  const r = calculatePearsonCorrelation(pairs);
  const classification = classifyCorrelation(r);

  return {
    r: Math.round(r * 100) / 100,
    classification,
    label: getCorrelationLabel(classification),
    sampleSize: pairs.length,
    pairs,
  };
}

// ── Weekly Pattern Detection ──

export type WeeklyPatternType = 'controlled' | 'elevated' | 'risk';

export interface WeeklyPatternResult {
  pattern: WeeklyPatternType;
  label: string;
  weeklyTotals: number[];
  avgWeekly: number;
  daysWithConsumption: number;
  trend: 'up' | 'down' | 'stable';
}

export function getWeeklyPatternLabel(p: WeeklyPatternType): string {
  switch (p) {
    case 'controlled': return 'Controlado';
    case 'elevated': return '⚠ Padrão Elevado';
    case 'risk': return '🔴 Padrão de Risco';
  }
}

export function getWeeklyPatternColor(p: WeeklyPatternType): string {
  switch (p) {
    case 'controlled': return 'text-green-500';
    case 'elevated': return 'text-yellow-500';
    case 'risk': return 'text-red-500';
  }
}

export function getWeeklyPattern(entries: AlcoholIntakeEntry[]): WeeklyPatternResult {
  const today = new Date();
  const weeklyTotals: number[] = [];
  const weeklyDays: number[] = [];

  // Analyze last 4 weeks
  for (let w = 0; w < 4; w++) {
    let weekTotal = 0;
    let daysWithDrinks = 0;
    for (let d = 0; d < 7; d++) {
      const checkDate = format(subDays(today, w * 7 + d), 'yyyy-MM-dd');
      const dayTotal = getDailyTotal(entries, checkDate);
      weekTotal += dayTotal;
      if (dayTotal > 0) daysWithDrinks++;
    }
    weeklyTotals.push(Math.round(weekTotal * 10) / 10);
    weeklyDays.push(daysWithDrinks);
  }

  const currentWeekTotal = weeklyTotals[0];
  const currentWeekDays = weeklyDays[0];
  const avgWeekly = Math.round((weeklyTotals.reduce((s, v) => s + v, 0) / 4) * 10) / 10;

  // Trend: compare first 2 weeks avg vs last 2 weeks avg
  const recentAvg = (weeklyTotals[0] + weeklyTotals[1]) / 2;
  const olderAvg = (weeklyTotals[2] + weeklyTotals[3]) / 2;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (olderAvg > 0 && ((recentAvg - olderAvg) / olderAvg) > 0.2) trend = 'up';
  else if (olderAvg > 0 && ((olderAvg - recentAvg) / olderAvg) > 0.2) trend = 'down';

  // Growth check: 3 consecutive weeks increasing >20%
  let growthPattern = false;
  if (weeklyTotals[2] > 0 && weeklyTotals[1] > 0) {
    const g1 = (weeklyTotals[1] - weeklyTotals[2]) / weeklyTotals[2];
    const g2 = (weeklyTotals[0] - weeklyTotals[1]) / weeklyTotals[1];
    if (g1 > 0.2 && g2 > 0.2) growthPattern = true;
  }

  // Classify
  let pattern: WeeklyPatternType = 'controlled';

  if (currentWeekTotal >= 60 || currentWeekDays >= 5) {
    pattern = 'risk';
  } else if (currentWeekDays >= 3 || avgWeekly > 40 || growthPattern) {
    pattern = 'elevated';
  }

  return {
    pattern,
    label: getWeeklyPatternLabel(pattern),
    weeklyTotals,
    avgWeekly,
    daysWithConsumption: currentWeekDays,
    trend,
  };
}

// ── Performance Alert ──

export function getPerformanceAlert(
  correlation: CorrelationResult | null,
  weeklyAvg: number,
  deltaHRVPairs?: { y: number }[]
): string | null {
  if (!correlation) return null;

  const { classification, r } = correlation;

  // Strong correlation + multiple >10% drops
  if (classification === 'strong_negative' && deltaHRVPairs) {
    const bigDrops = deltaHRVPairs.filter(p => p.y < -10).length;
    if (bigDrops >= 3) {
      return 'Padrão fisiológico consistente de impacto na recuperação.';
    }
  }

  // Moderate/strong + weekly avg > 30g
  if ((classification === 'moderate_negative' || classification === 'strong_negative') && weeklyAvg > 30) {
    return 'Possível impacto consistente na recuperação autonômica.';
  }

  return null;
}

export function getTrendArrow(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'stable': return '→';
  }
}
