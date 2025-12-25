export interface StravaConnection {
  id: string;
  user_id: string;
  strava_athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  athlete_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: 'Run' | 'Bike' | 'Strength';
  stravaType: string;
  date: string;
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
  hasHeartrate: boolean;
}

export interface StravaActivityDetails extends StravaActivity {
  zones: {
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  } | null;
  tss: number | null;
  tssMethod: 'HR_zones' | 'HR_avg' | null;
  lthrUsed: number | null;
}
