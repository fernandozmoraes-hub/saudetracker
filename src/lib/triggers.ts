import { HRVStatus, Workout } from '@/types/health';

export interface AnalysisData {
  today: {
    hrv: number;
    hrvStatus: HRVStatus;
    restingHr: number;
    sleepHours: number;
    sleepQuality: number;
    bodyBattery?: number;
    mood?: number;
  };
  trainingLoad: {
    atl: number;
    ctl: number;
    tsb: number;
  };
  trends: {
    hrvBaseline7d: number;
    hrvVsBaseline: number;
    consecutiveCriticalDays: number;
    consecutiveLowSleepDays: number;
    atlTrend5d: 'increasing' | 'stable' | 'decreasing';
  };
  recentWorkouts: Workout[];
}

export interface TriggerResult {
  classification: 'safe' | 'attention' | 'risk' | 'blocked';
  reasons: string[];
  canProceed: boolean;
}

export function evaluateTriggers(data: AnalysisData): TriggerResult {
  const reasons: string[] = [];
  
  // BLOQUEIO - dados insuficientes
  if (!data.today.hrv || data.trainingLoad.atl === undefined || data.trainingLoad.ctl === undefined) {
    return { 
      classification: 'blocked', 
      reasons: ['Dados insuficientes para avaliação'], 
      canProceed: false 
    };
  }

  const { tsb } = data.trainingLoad;
  const { hrvStatus, sleepHours } = data.today;
  const { consecutiveCriticalDays, consecutiveLowSleepDays, atlTrend5d } = data.trends;

  // 🔴 ALTO RISCO
  if (tsb < -15) {
    reasons.push('TSB < -15');
  }
  if (consecutiveCriticalDays >= 2) {
    reasons.push(`HRV Critical por ${consecutiveCriticalDays} dias`);
  }
  if (atlTrend5d === 'increasing' && consecutiveCriticalDays >= 1) {
    reasons.push('ATL crescente com sinais de fadiga');
  }
  if (consecutiveLowSleepDays >= 2) {
    reasons.push(`Sono < 6h por ${consecutiveLowSleepDays} dias`);
  }

  if (reasons.length > 0 && (tsb < -15 || consecutiveCriticalDays >= 2 || consecutiveLowSleepDays >= 2)) {
    return { classification: 'risk', reasons, canProceed: true };
  }

  // 🟡 ATENÇÃO
  const attentionReasons: string[] = [];
  
  if (tsb >= -15 && tsb < -5) {
    attentionReasons.push('TSB entre -5 e -15');
  }
  if (hrvStatus === 'Alert') {
    attentionReasons.push('HRV em alerta');
  }
  if (sleepHours >= 6 && sleepHours < 6.5) {
    attentionReasons.push('Sono entre 6-6.5h');
  }
  if (consecutiveCriticalDays === 1) {
    attentionReasons.push('HRV Critical ontem');
  }

  if (attentionReasons.length > 0) {
    return { classification: 'attention', reasons: attentionReasons, canProceed: true };
  }

  // 🟢 SEGURO
  return { classification: 'safe', reasons: [], canProceed: true };
}

export function getClassificationEmoji(classification: TriggerResult['classification']): string {
  switch (classification) {
    case 'safe': return '🟢';
    case 'attention': return '🟡';
    case 'risk': return '🔴';
    case 'blocked': return '⚪';
  }
}

export function getClassificationLabel(classification: TriggerResult['classification']): string {
  switch (classification) {
    case 'safe': return 'Seguro';
    case 'attention': return 'Atenção';
    case 'risk': return 'Alto Risco';
    case 'blocked': return 'Dados Insuficientes';
  }
}
