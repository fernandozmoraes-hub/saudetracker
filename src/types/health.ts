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

export interface Workout {
  id: string;
  date: string; // ISO date string
  type: WorkoutType;
  durationMin: number;
  rpe: number; // 0-10
  tssSubjective: number; // calculated: (duration × rpe) / 10
  validated: boolean; // for strength training
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
