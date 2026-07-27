import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SYNC_SECRET = Deno.env.get('WEEKLY_PLAN_SYNC_SECRET');
const ATHLETE_EMAIL = Deno.env.get('WEEKLY_PLAN_ATHLETE_EMAIL') || 'fernandozmoraes@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-sync-secret, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Plano periodizado de 16 semanas (Treinador Master), destilado de
 * references/plano-16-semanas.md da skill treinador-master. Semana 1 começa
 * na segunda-feira de PLAN_START_MONDAY. Semanas de recuperação: 4, 8, 12, 16.
 * TSB baseline conhecido: CTL 6 / ATL 10 em BASELINE_DATE.
 */
const PLAN_START_MONDAY = '2026-07-06';
const BASELINE_DATE = '2026-07-03';
const BASELINE_CTL = 6;
const BASELINE_ATL = 10;

interface WeekConfig {
  block: 1 | 2 | 3 | 4;
  recovery: boolean;
  intensification: boolean;
  vo2: boolean;
  weekTss: number;
  wedZone: string;
  wedDetail: string;
  fridayTest: string | null; // descrição do teste, se a sexta desta semana for um reteste de FTP
}

const WEEKS: Record<number, WeekConfig> = {
  1: { block: 1, recovery: false, intensification: false, vo2: false, weekTss: 130, wedZone: 'Z2 + Z3', wedDetail: 'Z2 + 2x8min Z3', fridayTest: null },
  2: { block: 1, recovery: false, intensification: false, vo2: false, weekTss: 150, wedZone: 'Z2 + Z3', wedDetail: 'Z2 + 3x8min Z3', fridayTest: null },
  3: { block: 1, recovery: false, intensification: true, vo2: false, weekTss: 170, wedZone: 'Z2 + Z3', wedDetail: 'Z2 + 3x10min Z3', fridayTest: null },
  4: { block: 1, recovery: true, intensification: false, vo2: false, weekTss: 100, wedZone: 'Z1-Z2', wedDetail: 'Recuperação: só Z1-Z2, RPE ≤6', fridayTest: null },
  5: { block: 2, recovery: false, intensification: false, vo2: false, weekTss: 175, wedZone: 'Sweet Spot', wedDetail: '3x10min @ 88-92% FTP (194-202W)', fridayTest: null },
  6: { block: 2, recovery: false, intensification: false, vo2: false, weekTss: 195, wedZone: 'Sweet Spot', wedDetail: '3x12min SS', fridayTest: null },
  7: { block: 2, recovery: false, intensification: true, vo2: false, weekTss: 215, wedZone: 'Sweet Spot', wedDetail: '4x12min SS ou 2x20min', fridayTest: null },
  8: { block: 2, recovery: true, intensification: false, vo2: false, weekTss: 120, wedZone: 'Z1-Z2', wedDetail: 'Recuperação: só Z1-Z2, RPE ≤6', fridayTest: 'Reteste de FTP: 20 min no maior esforço sustentável constante. FTP = 95% da potência média. Atualizar perfil.md e recalcular faixas de watts.' },
  9: { block: 3, recovery: false, intensification: false, vo2: true, weekTss: 200, wedZone: 'VO2', wedDetail: '4x3min @ 106-112% FTP (233-246W)', fridayTest: null },
  10: { block: 3, recovery: false, intensification: false, vo2: true, weekTss: 220, wedZone: 'VO2', wedDetail: '5x3min VO2', fridayTest: null },
  11: { block: 3, recovery: false, intensification: true, vo2: true, weekTss: 235, wedZone: 'VO2', wedDetail: '5x4min VO2 ou 6x3min', fridayTest: null },
  12: { block: 3, recovery: true, intensification: false, vo2: false, weekTss: 130, wedZone: 'Z1-Z2', wedDetail: 'Recuperação: Z1-Z2 apenas', fridayTest: null },
  13: { block: 4, recovery: false, intensification: false, vo2: true, weekTss: 240, wedZone: 'VO2', wedDetail: '5x4min VO2 + 1 sessão limiar (limiar substitui a sessão SS na sexta desta semana)', fridayTest: null },
  14: { block: 4, recovery: false, intensification: true, vo2: true, weekTss: 255, wedZone: 'VO2', wedDetail: '6x4min VO2 (pico absoluto do plano)', fridayTest: null },
  15: { block: 4, recovery: false, intensification: false, vo2: true, weekTss: 220, wedZone: 'VO2', wedDetail: '4x4min VO2 + limiar (limiar substitui a sessão SS na sexta desta semana)', fridayTest: null },
  16: { block: 4, recovery: true, intensification: false, vo2: false, weekTss: 130, wedZone: 'Z1-Z2', wedDetail: 'Recuperação + reavaliação completa', fridayTest: 'Reteste de FTP: 20 min no maior esforço sustentável constante + teste extra de 5 min all-out (proxy de potência aeróbica máxima).' },
};

const VO2_MEDICAL_GATE =
  '⚠️ Sessão de VO2/Z5: confirme com o cardiologista (exames de 23/02 e 28/01/2026) antes de prosseguir. Sem liberação, substituir por limiar sub-LV2 (FC ≤135 bpm).';

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Segunda-feira (UTC) da semana corrente, no horário de São Paulo (UTC-3). */
function currentMonday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000); // aproxima America/Sao_Paulo (sem DST)
  const day = now.getUTCDay(); // 0=dom..6=sáb
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  return isoDate(monday);
}

function weekIndexFor(mondayIso: string): number {
  const start = new Date(`${PLAN_START_MONDAY}T00:00:00Z`).getTime();
  const monday = new Date(`${mondayIso}T00:00:00Z`).getTime();
  return Math.round((monday - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function round(n: number): number {
  return Math.round(n);
}

interface DayRow {
  type: 'endurance' | 'strength' | 'hiit' | 'recovery';
  planned_duration_min: number;
  planned_zone: string;
  planned_tss: number;
  notes: string;
}

function strengthNotes(label: string, cfg: WeekConfig, isThursday: boolean, hardTrend: boolean): string {
  const parts = [label];
  if (cfg.recovery) {
    parts.push('Semana de recuperação: 2 séries por exercício, RPE ≤6, sem progressão de carga.');
  } else if (cfg.intensification) {
    parts.push('Semana de intensificação: reduza para 2 séries por exercício (prioridade é a bike).');
  } else if (cfg.block >= 3 && isThursday) {
    parts.push('Bloco 3-4: agachamento e leg press em 4x6-8 (mais carga, menos reps).');
  } else {
    parts.push('Dupla progressão: no topo da faixa de reps com RPE ≤8, suba 2,5 kg (superiores) / 5 kg (inferiores).');
  }
  if (isThursday) {
    parts.push('Regra Whoop: se o recovery não estiver verde hoje, RPE ≤6 e sem progressão de carga (só ~24h após o bike intenso de quarta).');
  }
  if (hardTrend && isThursday) {
    parts.push('⚠️ HRV abaixo do basal por 3+ dias: sem progressão de carga esta semana, independente do recovery de hoje.');
  }
  return parts.join(' ');
}

function buildWeek(weekIdx: number, cfg: WeekConfig, adjustment: { tsbRecovery: boolean; hrvDowngrade: boolean }): DayRow[] {
  const effectiveRecovery = cfg.recovery || adjustment.tsbRecovery;

  const seg: DayRow = effectiveRecovery
    ? { type: 'recovery', planned_duration_min: 40, planned_zone: 'Z1-Z2 leve', planned_tss: round(cfg.weekTss * 0.25), notes: 'Semana de recuperação: leve, sem intensidade.' }
    : { type: 'endurance', planned_duration_min: 60, planned_zone: 'Z2 (103-127 bpm / 122-165W)', planned_tss: round(cfg.weekTss * 0.22), notes: 'Base aeróbica. FC teto ~110-112 bpm (zona medida) na bike.' };

  const ter: DayRow = {
    type: 'strength',
    planned_duration_min: 55,
    planned_zone: '',
    planned_tss: round(cfg.weekTss * 0.05),
    notes: strengthNotes('Musculação B (superiores + cadeia posterior + core).', cfg, false, adjustment.hrvDowngrade),
  };

  const qua: DayRow = effectiveRecovery
    ? { type: 'recovery', planned_duration_min: 45, planned_zone: 'Z1-Z2', planned_tss: round(cfg.weekTss * 0.2), notes: 'Semana de recuperação: sem sessão intensa.' }
    : adjustment.hrvDowngrade
    ? { type: 'endurance', planned_duration_min: 60, planned_zone: 'Z2', planned_tss: round(cfg.weekTss * 0.25), notes: '⚠️ HRV abaixo do basal por 3+ dias seguidos: sessão intensa (' + cfg.wedDetail + ') substituída por Z2 esta semana.' }
    : { type: 'hiit', planned_duration_min: 60, planned_zone: cfg.wedZone, planned_tss: round(cfg.weekTss * 0.35), notes: cfg.wedDetail + (cfg.vo2 ? ' ' + VO2_MEDICAL_GATE : '') };

  const qui: DayRow = {
    type: 'strength',
    planned_duration_min: 55,
    planned_zone: '',
    planned_tss: round(cfg.weekTss * 0.05),
    notes: strengthNotes('Musculação A (inferiores + core).', cfg, true, adjustment.hrvDowngrade),
  };

  const sex: DayRow = cfg.fridayTest
    ? { type: 'hiit', planned_duration_min: 35, planned_zone: 'Teste', planned_tss: round(cfg.weekTss * 0.15), notes: cfg.fridayTest }
    : effectiveRecovery
    ? { type: 'recovery', planned_duration_min: 40, planned_zone: 'Z1-Z2 leve', planned_tss: round(cfg.weekTss * 0.18), notes: 'Semana de recuperação.' }
    : { type: 'endurance', planned_duration_min: 80, planned_zone: 'Z2 (103-127 bpm / 122-165W)', planned_tss: round(cfg.weekTss * 0.28), notes: 'Volume aeróbico longo (60-90min — reduza a duração se sentir peso nas pernas).' };

  const sab: DayRow = {
    type: 'strength',
    planned_duration_min: 55,
    planned_zone: '',
    planned_tss: round(cfg.weekTss * 0.05),
    notes: strengthNotes('Musculação B (superiores + cadeia posterior + core, repetição).', cfg, false, adjustment.hrvDowngrade),
  };

  return [seg, ter, qua, qui, sex, sab];
}

/** Rola CTL/ATL dia a dia a partir do baseline usando o TSS diário (tss_final || tss_subjective, 0 nos dias sem treino). */
function rollCtlAtl(dailyTss: Record<string, number>, uptoIso: string): { ctl: number; atl: number }[] {
  let ctl = BASELINE_CTL;
  let atl = BASELINE_ATL;
  const series: { date: string; ctl: number; atl: number }[] = [];
  let cursor = BASELINE_DATE;
  while (cursor <= uptoIso) {
    const tss = dailyTss[cursor] || 0;
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    series.push({ date: cursor, ctl, atl });
    cursor = addDays(cursor, 1);
  }
  return series;
}

async function resolveAthleteId(supabase: any, email: string): Promise<string | null> {
  let page = 1;
  while (page <= 5) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`admin_list_users_failed: ${error.message}`);
    const match = data.users.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
    page++;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return json({ ok: true, service: 'weekly-plan-sync' });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!SYNC_SECRET || req.headers.get('X-Sync-Secret') !== SYNC_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'not_configured' }, 503);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const athleteId = await resolveAthleteId(supabase, ATHLETE_EMAIL);
    if (!athleteId) return json({ error: 'athlete_not_found', email: ATHLETE_EMAIL }, 404);

    const monday = currentMonday();
    const saturday = addDays(monday, 5);
    const weekIdx = weekIndexFor(monday);
    const cfg = WEEKS[weekIdx];
    if (!cfg) {
      return json({ ok: true, skipped: true, reason: 'week_out_of_range', weekIdx, monday });
    }

    // Contexto recente para as regras de ajuste (seção 6 do plano)
    const since = addDays(monday, -10);
    const yesterday = addDays(monday, -1);

    const { data: checks } = await supabase
      .from('daily_checks')
      .select('date, hrv, resting_hr, sleep_hours, sleep_quality, body_battery')
      .eq('user_id', athleteId)
      .gte('date', since)
      .lte('date', yesterday)
      .order('date', { ascending: true });

    const { data: workouts } = await supabase
      .from('workouts')
      .select('date, tss_subjective, tss_final')
      .eq('user_id', athleteId)
      .gte('date', BASELINE_DATE)
      .lte('date', yesterday);

    const dailyTss: Record<string, number> = {};
    for (const w of workouts || []) {
      const tss = (w.tss_final ?? w.tss_subjective ?? 0) as number;
      dailyTss[w.date] = (dailyTss[w.date] || 0) + tss;
    }
    const ctlAtlSeries = rollCtlAtl(dailyTss, yesterday);
    const last3 = ctlAtlSeries.slice(-3);
    const tsbRecovery = last3.length === 3 && last3.every((d) => d.ctl - d.atl < -15);

    const recentChecks = checks || [];
    const hrvValues = recentChecks.slice(0, -3).map((c: any) => c.hrv).filter((v: number) => v != null);
    const hrvBaseline = hrvValues.length ? hrvValues.reduce((a: number, b: number) => a + b, 0) / hrvValues.length : null;
    const last3Checks = recentChecks.slice(-3);
    const hrvDowngrade =
      hrvBaseline != null &&
      last3Checks.length === 3 &&
      last3Checks.every((c: any) => c.hrv != null && c.hrv < hrvBaseline);

    const rows = buildWeek(weekIdx, cfg, { tsbRecovery, hrvDowngrade });
    const dates = [monday, addDays(monday, 1), addDays(monday, 2), addDays(monday, 3), addDays(monday, 4), addDays(monday, 5)];

    // Limpa planos ainda não vinculados a um treino real nesta semana antes de reinserir
    await supabase
      .from('training_plans')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('status', 'planned')
      .is('workout_id', null)
      .gte('date', monday)
      .lte('date', saturday);

    const insertRows = rows.map((row, i) => ({
      coach_id: athleteId,
      athlete_id: athleteId,
      date: dates[i],
      type: row.type,
      planned_duration_min: row.planned_duration_min,
      planned_zone: row.planned_zone || null,
      planned_tss: row.planned_tss,
      notes: row.notes,
      status: 'planned',
    }));

    const { error: insertError } = await supabase.from('training_plans').insert(insertRows);
    if (insertError) {
      console.error('weekly_plan_sync insert_failed', insertError.message);
      return json({ error: 'insert_failed', message: insertError.message }, 500);
    }

    console.log('weekly_plan_sync done', { weekIdx, block: cfg.block, monday, tsbRecovery, hrvDowngrade, rows: insertRows.length });

    return json({
      ok: true,
      weekIdx,
      block: cfg.block,
      monday,
      saturday,
      adjustment: tsbRecovery ? 'tsb_recovery' : hrvDowngrade ? 'hrv_downgrade' : 'baseline',
      rows_written: insertRows.length,
    });
  } catch (err: unknown) {
    console.error('weekly_plan_sync uncaught_error', err instanceof Error ? err.message : err);
    return json({ error: err instanceof Error ? err.message : 'unknown_error' }, 500);
  }
});
