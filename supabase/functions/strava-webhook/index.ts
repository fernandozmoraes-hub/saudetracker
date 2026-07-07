import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Token de verificação do webhook — o Strava devolve este valor no handshake de assinatura
const VERIFY_TOKEN = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN') || 'saudetracker-webhook';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Mesmo mapeamento do strava-import, restrito aos tipos aceitos pela tabela workouts
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  Run: 'Run',
  VirtualRun: 'Run',
  TrailRun: 'Run',
  Ride: 'Bike',
  VirtualRide: 'Bike',
  MountainBikeRide: 'Bike',
  GravelRide: 'Bike',
  EBikeRide: 'Bike',
  WeightTraining: 'Strength',
  Workout: 'Strength',
};

// Compatibilidade workout importado → treino planejado (training_plans.type)
const PLAN_TYPE_COMPAT: Record<string, string[]> = {
  Bike: ['endurance', 'hiit', 'recovery'],
  Run: ['endurance', 'hiit', 'recovery'],
  Strength: ['strength'],
};

const ZONE_WEIGHTS: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.2, 5: 1.4 };

interface HrZone { zone: number; lowerBpm: number; upperBpm: number }

function calculateZones(lthr: number, z1u: number, z2u: number, z3u: number, z4u: number): HrZone[] {
  return [
    { zone: 1, lowerBpm: 0, upperBpm: Math.round((lthr * z1u) / 100) },
    { zone: 2, lowerBpm: Math.round((lthr * (z1u + 1)) / 100), upperBpm: Math.round((lthr * z2u) / 100) },
    { zone: 3, lowerBpm: Math.round((lthr * (z2u + 1)) / 100), upperBpm: Math.round((lthr * z3u) / 100) },
    { zone: 4, lowerBpm: Math.round((lthr * (z3u + 1)) / 100), upperBpm: Math.round((lthr * z4u) / 100) },
    { zone: 5, lowerBpm: Math.round((lthr * (z4u + 1)) / 100), upperBpm: 999 },
  ];
}

function determineZone(hr: number, zones: HrZone[]): number {
  for (const z of zones) if (hr <= z.upperBpm) return z.zone;
  return 5;
}

function calculateTimePerZone(hrStream: number[], tStream: number[], zones: HrZone[]) {
  const result = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  for (let i = 1; i < hrStream.length; i++) {
    const duration = (tStream[i] - tStream[i - 1]) / 60;
    const zone = determineZone(hrStream[i], zones);
    result[`z${zone}` as keyof typeof result] += duration;
  }
  return result;
}

function calculateHrTssByZones(z: { z1: number; z2: number; z3: number; z4: number; z5: number }): number {
  const tss =
    ((z.z1 / 60) * Math.pow(ZONE_WEIGHTS[1], 2) +
      (z.z2 / 60) * Math.pow(ZONE_WEIGHTS[2], 2) +
      (z.z3 / 60) * Math.pow(ZONE_WEIGHTS[3], 2) +
      (z.z4 / 60) * Math.pow(ZONE_WEIGHTS[4], 2) +
      (z.z5 / 60) * Math.pow(ZONE_WEIGHTS[5], 2)) *
    100;
  return Math.round(tss);
}

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
      }),
    });
    if (!response.ok) throw new Error(`refresh_failed status=${response.status}`);
    const tokenData = await response.json();
    await supabase
      .from('strava_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
      })
      .eq('id', connection.id);
    return tokenData.access_token;
  }
  return connection.access_token;
}

/**
 * Processa um evento de atividade: importa a atividade como workout (se ainda não existir)
 * e marca o treino planejado correspondente do dia como concluído.
 */
async function processActivityEvent(objectId: number, ownerId: number) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const { data: connection } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('strava_athlete_id', ownerId)
    .maybeSingle();

  if (!connection) {
    console.log('strava_webhook no_connection ownerId=', ownerId);
    return;
  }
  const userId = connection.user_id;

  const accessToken = await refreshTokenIfNeeded(supabase, connection);

  const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${objectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!activityResponse.ok) {
    console.error('strava_webhook activity_fetch_failed', activityResponse.status);
    return;
  }
  const activity = await activityResponse.json();

  const mapped = ACTIVITY_TYPE_MAP[activity.type] || ACTIVITY_TYPE_MAP[activity.sport_type];
  if (!mapped) {
    console.log('strava_webhook unsupported_type', activity.type, activity.sport_type);
    return;
  }

  const date = activity.start_date_local ? activity.start_date_local.split('T')[0] : null;
  if (!date) return;
  const durationMin = activity.moving_time ? Math.round((activity.moving_time / 60) * 10) / 10 : 0;
  const avgHr = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;

  // Dedupe: atividade já importada (pelo webhook ou manualmente)
  const { data: existing } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('strava_activity_id', objectId)
    .maybeSingle();

  let workoutId = existing?.id as string | undefined;

  if (!workoutId) {
    // TSS: por zonas de FC quando houver stream, senão por FC média
    const { data: settings } = await supabase
      .from('user_settings')
      .select('lthr, zone1_upper_pct, zone2_upper_pct, zone3_upper_pct, zone4_upper_pct')
      .eq('user_id', userId)
      .single();
    const lthr = settings?.lthr || 165;

    let tss: number | null = null;
    let tssMethod: string | null = null;
    let timePerZone: { z1: number; z2: number; z3: number; z4: number; z5: number } | null = null;

    if (activity.has_heartrate) {
      const streamResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${objectId}/streams?keys=heartrate,time&key_by_type=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (streamResponse.ok) {
        const streamData = await streamResponse.json();
        if (streamData.heartrate?.data && streamData.time?.data) {
          const zones = calculateZones(
            lthr,
            settings?.zone1_upper_pct || 84,
            settings?.zone2_upper_pct || 89,
            settings?.zone3_upper_pct || 94,
            settings?.zone4_upper_pct || 99,
          );
          timePerZone = calculateTimePerZone(streamData.heartrate.data, streamData.time.data, zones);
          tss = calculateHrTssByZones(timePerZone);
          tssMethod = 'HR_zones';
        }
      }
    }
    if (tss === null && avgHr) {
      const intensity = avgHr / lthr;
      tss = Math.round((durationMin / 60) * Math.pow(intensity, 2) * 100);
      tssMethod = 'HR_avg';
    }

    const { data: inserted, error: insertError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        date,
        type: mapped,
        session_type: mapped === 'Strength' ? 'strength' : 'endurance',
        tss_version: 'v2_hybrid',
        duration_min: Math.round(durationMin),
        rpe: 0,
        tss_subjective: 0,
        tss_final: tss,
        validated: true,
        distance_km: activity.distance ? Math.round((activity.distance / 1000) * 100) / 100 : null,
        avg_hr: avgHr,
        lthr_used: tss !== null ? lthr : null,
        tss_method: tssMethod,
        time_z1_min: timePerZone ? Math.round(timePerZone.z1 * 10) / 10 : 0,
        time_z2_min: timePerZone ? Math.round(timePerZone.z2 * 10) / 10 : 0,
        time_z3_min: timePerZone ? Math.round(timePerZone.z3 * 10) / 10 : 0,
        time_z4_min: timePerZone ? Math.round(timePerZone.z4 * 10) / 10 : 0,
        time_z5_min: timePerZone ? Math.round(timePerZone.z5 * 10) / 10 : 0,
        strava_activity_id: objectId,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('strava_webhook workout_insert_failed', insertError.message);
      return;
    }
    workoutId = inserted.id;
    console.log('strava_webhook workout_created', workoutId, mapped, date);
  }

  // Match com o plano do dia: mesmo atleta, mesma data, ainda "planned", tipo compatível
  const compatTypes = PLAN_TYPE_COMPAT[mapped] || [];
  const { data: plans } = await supabase
    .from('training_plans')
    .select('id, type')
    .eq('athlete_id', userId)
    .eq('date', date)
    .eq('status', 'planned')
    .in('type', compatTypes)
    .order('created_at', { ascending: true })
    .limit(1);

  if (plans && plans.length > 0) {
    const { error: updateError } = await supabase
      .from('training_plans')
      .update({ status: 'completed', workout_id: workoutId })
      .eq('id', plans[0].id);
    if (updateError) {
      console.error('strava_webhook plan_update_failed', updateError.message);
    } else {
      console.log('strava_webhook plan_completed', plans[0].id, 'workout', workoutId);
    }
  } else {
    console.log('strava_webhook no_matching_plan', date, mapped);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // ============= GET: handshake de assinatura do Strava + ações administrativas =============
  if (req.method === 'GET') {
    // Handshake: o Strava chama GET ?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
    const hubMode = url.searchParams.get('hub.mode');
    const hubChallenge = url.searchParams.get('hub.challenge');
    const hubVerifyToken = url.searchParams.get('hub.verify_token');
    if (hubMode === 'subscribe' && hubChallenge) {
      if (hubVerifyToken !== VERIFY_TOKEN) return json({ error: 'verify_token mismatch' }, 403);
      return json({ 'hub.challenge': hubChallenge });
    }

    // Ações administrativas (protegidas pelo mesmo verify token)
    const action = url.searchParams.get('action');
    const secret = url.searchParams.get('secret');
    if (action) {
      if (secret !== VERIFY_TOKEN) return json({ error: 'unauthorized' }, 401);

      if (action === 'subscribe') {
        const callbackUrl = `${SUPABASE_URL}/functions/v1/strava-webhook`;
        const resp = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: STRAVA_CLIENT_ID!,
            client_secret: STRAVA_CLIENT_SECRET!,
            callback_url: callbackUrl,
            verify_token: VERIFY_TOKEN,
          }),
        });
        const body = await resp.json().catch(() => ({}));
        return json({ status: resp.status, callback_url: callbackUrl, response: body }, resp.ok ? 200 : 502);
      }

      if (action === 'status') {
        const qs = new URLSearchParams({ client_id: STRAVA_CLIENT_ID!, client_secret: STRAVA_CLIENT_SECRET! });
        const resp = await fetch(`https://www.strava.com/api/v3/push_subscriptions?${qs}`);
        const body = await resp.json().catch(() => ({}));
        return json({ status: resp.status, subscriptions: body });
      }

      if (action === 'unsubscribe') {
        const subId = url.searchParams.get('id');
        if (!subId) return json({ error: 'id is required' }, 400);
        const qs = new URLSearchParams({ client_id: STRAVA_CLIENT_ID!, client_secret: STRAVA_CLIENT_SECRET! });
        const resp = await fetch(`https://www.strava.com/api/v3/push_subscriptions/${subId}?${qs}`, { method: 'DELETE' });
        return json({ status: resp.status });
      }

      return json({ error: 'invalid action' }, 400);
    }

    return json({ ok: true, service: 'strava-webhook' });
  }

  // ============= POST: evento do Strava =============
  if (req.method === 'POST') {
    let event: any;
    try {
      event = await req.json();
    } catch {
      return json({ error: 'invalid body' }, 400);
    }

    console.log('strava_webhook event', JSON.stringify({
      object_type: event.object_type,
      aspect_type: event.aspect_type,
      object_id: event.object_id,
      owner_id: event.owner_id,
    }));

    // O Strava exige resposta 200 em até 2s; o processamento segue em background
    if (event.object_type === 'activity' && (event.aspect_type === 'create' || event.aspect_type === 'update')) {
      const task = processActivityEvent(Number(event.object_id), Number(event.owner_id)).catch((e) =>
        console.error('strava_webhook process_error', e instanceof Error ? e.message : e),
      );
      // @ts-ignore EdgeRuntime existe no ambiente de edge functions do Supabase
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(task);
      } else {
        await task;
      }
    }

    return json({ received: true });
  }

  return json({ error: 'method not allowed' }, 405);
});
