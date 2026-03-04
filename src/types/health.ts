export interface DailyCheck {
  date: string; // ISO date string YYYY-MM-DD
  hrv: number; // ms
  restingHr: number; // bpm
  sleepHours: number; // decimal
  sleepQuality: number; // 1-5
  mood?: number; // 1-5
  bodyBattery?: number; // 0-100
  notes?: string;
  alcoholYesterday?: boolean;
}

export type WorkoutType = 'Run' | 'Strength' | 'Bike' | 'Rest';

// Novos tipos para modelo híbrido TSS v2
export type SessionType = 'endurance' | 'strength' | 'legacy';
export type TssVersion = 'v1_rpe' | 'v2_hybrid';
export type TssMethod = 'HR_avg' | 'HR_zones' | 'RPE';

export interface Workout {
  id: string;
  date: string; // ISO date string
  type: WorkoutType;
  sessionType: SessionType; // tipo de sessão para cálculo
  tssVersion: TssVersion; // versão do modelo de cálculo
  durationMin: number;
  rpe: number; // 0-10
  tssSubjective: number; // mantido para compatibilidade
  tssFinal: number; // valor imutável usado para CTL/ATL/TSB
  validated: boolean; // for strength training
  distanceKm?: number; // km, for Run/Bike
  avgHr?: number; // bpm, for Run/Bike
  lthrUsed?: number; // LTHR usado no cálculo (auditoria)
  muscleGroups?: string[]; // for Strength training
  // HR-TSS por zonas (v3)
  timeZ1Min?: number;
  timeZ2Min?: number;
  timeZ3Min?: number;
  timeZ4Min?: number;
  timeZ5Min?: number;
  tssMethod?: TssMethod; // 'HR_avg' (legado), 'HR_zones' (novo), 'RPE' (força)
  equipmentId?: string; // FK to equipment table
}

// Configurações do usuário
export interface UserSettings {
  id?: string;
  userId?: string;
  lthr: number; // FC de limiar (padrão: 165 bpm)
  restingHr?: number; // FC de repouso
  maxHr?: number; // FC máxima
  // Limites de zona (% do LTHR)
  zone1UpperPct: number; // padrão 84
  zone2UpperPct: number; // padrão 89
  zone3UpperPct: number; // padrão 94
  zone4UpperPct: number; // padrão 99
}

// Zonas de FC com pesos TP-like
export interface HrZone {
  zone: number;
  lowerPct: number;
  upperPct: number;
  weight: number; // 0.6, 0.8, 1.0, 1.2, 1.4
  lowerBpm?: number;
  upperBpm?: number;
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

// Body Composition types
export type DataSource = 'manual' | 'smart_scale';
export type MuscleIntegrityStatus = 'preserved' | 'declining' | 'at_risk';

export interface BodyCompositionEntry {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  muscleMassKg: number;
  bodyFatPct: number;
  dataSource: DataSource;
  notes?: string;
  flaggedInconsistent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Equipment (Running Shoes) types
// Alcohol types
export type DrinkType = 'beer' | 'wine';
export type AlcoholImpact = 'none' | 'light' | 'moderate' | 'high' | 'very_high';

export interface AlcoholIntakeEntry {
  id: string;
  userId: string;
  date: string;
  time?: string;
  drinkType: DrinkType;
  volumeMl: number;
  numDrinks: number;
  abvPercent: number;
  alcoholGrams: number;
  notes?: string;
}

export type EquipmentStatus = 'active' | 'attention' | 'retired';

export interface Equipment {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  startDate: string;
  totalKm: number;
  maxKm: number;
  status: EquipmentStatus;
  activeForSelection: boolean;
  createdAt?: string;
  updatedAt?: string;
}
