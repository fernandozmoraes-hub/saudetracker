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
