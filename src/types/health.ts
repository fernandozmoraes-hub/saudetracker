export interface DailyCheck {
  date: string; // ISO date string YYYY-MM-DD
  hrv: number; // ms
  restingHr: number; // bpm
  sleepHours: number; // decimal
  sleepQuality: number; // 1-5
  mood?: number; // 1-5
  bodyBattery?: number; // 0-100
  notes?: string;
}

export type WorkoutType = 'Run' | 'Strength' | 'Bike' | 'Rest';

// Novos tipos para modelo híbrido TSS v2
export type SessionType = 'endurance' | 'strength' | 'legacy';
export type TssVersion = 'v1_rpe' | 'v2_hybrid';

export interface Workout {
  id: string;
  date: string; // ISO date string
  type: WorkoutType;
  sessionType: SessionType; // NOVO - tipo de sessão para cálculo
  tssVersion: TssVersion; // NOVO - versão do modelo de cálculo
  durationMin: number;
  rpe: number; // 0-10
  tssSubjective: number; // mantido para compatibilidade
  tssFinal: number; // NOVO - valor imutável usado para CTL/ATL/TSB
  validated: boolean; // for strength training
  distanceKm?: number; // km, for Run/Bike
  avgHr?: number; // bpm, for Run/Bike
  lthrUsed?: number; // NOVO - LTHR usado no cálculo (auditoria)
  muscleGroups?: string[]; // for Strength training
}

// Configurações do usuário
export interface UserSettings {
  id?: string;
  userId?: string;
  lthr: number; // FC de limiar (padrão: 165 bpm)
}

export type HRVStatus = 'OK' | 'Alert' | 'Critical';

export interface HRVMetrics {
  baseline7d: number;
  currentHrv: number;
  status: HRVStatus;
  factor: number; // 1.0, 0.7, or 0.4
}

export interface LoadDay {
  date: string;
  tssEffective: number; // tss_subjective × HRV factor
}

export interface WeeklyLoad {
  weekId: string; // e.g., 2025-W03
  weeklyTss: number;
  atl: number; // 7-day moving average
  ctl: number; // 42-day exponential moving average
  tsb: number; // CTL - ATL
}

export interface TodayMetrics {
  hrv: number;
  hrvBaseline: number;
  hrvStatus: HRVStatus;
  hrvFactor: number;
  ctl: number;
  atl: number;
  tsb: number;
  recommendation: 'maintain' | 'reduce' | 'rest';
  alert?: string;
}
