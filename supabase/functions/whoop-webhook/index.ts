import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Valida a assinatura do WHOOP: base64(HMAC-SHA256(client_secret, timestamp + body)) */
async function isValidSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get('X-WHOOP-Signature');
  const timestamp = req.headers.get('X-WHOOP-Signature-Timestamp');
  if (!signature || !timestamp) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(WHOOP_CLIENT_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
        client_id: WHOOP_CLIENT_ID!,
        client_secret: WHOOP_CLIENT_SECRET!,
        scope: 'offline',
      }),
    });
    if (!response.ok) {
      // WHOOP envia recovery.updated e sleep.updated quase juntos para o mesmo evento,
      // então duas invocações deste webhook podem tentar renovar o mesmo refresh_token em
      // paralelo. Como o refresh_token é de uso único, quem perder a corrida recebe 400
      // mesmo a renovação tendo funcionado no outro lado. Antes de desistir, confere se a
      // conexão já foi atualizada por essa outra invocação.
      const { data: latest } = await supabase
        .from('whoop_connections')
        .select('access_token, expires_at')
        .eq('id', connection.id)
        .maybeSingle();
      if (latest && new Date(latest.expires_at).getTime() - Date.now() >= 5 * 60 * 1000) {
        return latest.access_token;
      }
      // Falha real: o refresh_token não é mais válido (revogado/expirado). Marca a conexão
      // para o Settings parar de mostrar "conectado" e o usuário precisar reautorizar.
      await supabase
        .from('whoop_connections')
        .update({ needs_reauth: true, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      throw new Error(`whoop_refresh_failed status=${response.status}`);
    }
    const tokenData = await response.json();
    await supabase
      .from('whoop_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString(),
        needs_reauth: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    return tokenData.access_token;
  }
  return connection.access_token;
}

/** Converte sleep_performance_percentage (0-100) para a escala 1-5 do app */
function performanceToQuality(pct: number | null | undefined): number {
  if (pct == null) return 3;
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 45) return 2;
  return 1;
}

/** Data local do fim do sono (dia do check-in), usando o timezone_offset do WHOOP (ex.: "-03:00") */
function localDateOf(utcIso: string, tzOffset: string | null): string {
  const base = new Date(utcIso).getTime();
  let offsetMs = 0;
  const m = (tzOffset || '').match(/^([+-])(\d{2}):(\d{2})$/);
  if (m) {
    offsetMs = (Number(m[2]) * 60 + Number(m[3])) * 60 * 1000 * (m[1] === '-' ? -1 : 1);
  }
  return new Date(base + offsetMs).toISOString().split('T')[0];
}

/**
 * Processa um evento: busca o recovery mais recente (HRV, FC repouso, recovery score),
 * o sono associado (duração, performance) e faz upsert do daily_check do dia.
 * Campos subjetivos (humor, álcool, notas) nunca são tocados.
 */
async function processEvent(whoopUserId: number) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const { data: connection } = await supabase
    .from('whoop_connections')
    .select('*')
    .eq('whoop_user_id', whoopUserId)
    .maybeSingle();

  if (!connection) {
    console.log('whoop_webhook no_connection whoopUserId=', whoopUserId);
    return;
  }

  const accessToken = await refreshTokenIfNeeded(supabase, connection);
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Recovery mais recente (vem depois do sono ser processado; carrega HRV e FC repouso)
  const recoveryResp = await fetch(`${WHOOP_API_BASE}/v2/recovery?limit=1`, { headers });
  if (!recoveryResp.ok) {
    console.error('whoop_webhook recovery_fetch_failed', recoveryResp.status);
    return;
  }
  const recoveryData = await recoveryResp.json();
  const recovery = recoveryData.records?.[0];
  if (!recovery || recovery.score_state !== 'SCORED' || !recovery.score) {
    console.log('whoop_webhook no_scored_recovery');
    return;
  }
  if (recovery.score.user_calibrating) {
    console.log('whoop_webhook user_calibrating, skip');
    return;
  }

  // Sono associado ao recovery (duração e performance)
  const sleepResp = await fetch(`${WHOOP_API_BASE}/v2/activity/sleep/${recovery.sleep_id}`, { headers });
  if (!sleepResp.ok) {
    console.error('whoop_webhook sleep_fetch_failed', sleepResp.status);
    return;
  }
  const sleep = await sleepResp.json();
  if (sleep.score_state !== 'SCORED' || !sleep.score) {
    console.log('whoop_webhook sleep_not_scored');
    return;
  }

  const stages = sleep.score.stage_summary || {};
  const asleepMs =
    (stages.total_light_sleep_time_milli || 0) +
    (stages.total_slow_wave_sleep_time_milli || 0) +
    (stages.total_rem_sleep_time_milli || 0);
  const sleepHours = Math.round((asleepMs / 3_600_000) * 10) / 10;

  const date = localDateOf(sleep.end, sleep.timezone_offset);
  const hrv = Math.round(Number(recovery.score.hrv_rmssd_milli));
  const restingHr = Math.round(Number(recovery.score.resting_heart_rate));
  const recoveryScore = Math.round(Number(recovery.score.recovery_score));

  if (!hrv || !restingHr || !sleepHours) {
    console.log('whoop_webhook incomplete_data', { hrv, restingHr, sleepHours });
    return;
  }

  // Upsert apenas dos campos objetivos; humor/álcool/notas permanecem do usuário
  const { error: upsertError } = await supabase
    .from('daily_checks')
    .upsert({
      user_id: connection.user_id,
      date,
      hrv,
      resting_hr: restingHr,
      sleep_hours: sleepHours,
      sleep_quality: performanceToQuality(sleep.score.sleep_performance_percentage),
      body_battery: recoveryScore,
    }, { onConflict: 'user_id,date' });

  if (upsertError) {
    console.error('whoop_webhook upsert_failed', upsertError.message);
    return;
  }
  console.log('whoop_webhook daily_check_upserted', date, { hrv, restingHr, sleepHours, recoveryScore });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Health check
  if (req.method === 'GET') {
    return json({ ok: true, service: 'whoop-webhook' });
  }

  if (req.method === 'POST') {
    const rawBody = await req.text();

    const validSignature = await isValidSignature(req, rawBody);
    if (!validSignature) {
      console.warn('whoop_webhook invalid_signature');
      return json({ error: 'invalid signature' }, 401);
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: 'invalid body' }, 400);
    }

    console.log('whoop_webhook event', JSON.stringify({
      type: event.type, user_id: event.user_id, trace_id: event.trace_id,
    }));

    if (event.type === 'recovery.updated' || event.type === 'sleep.updated') {
      const task = processEvent(Number(event.user_id)).catch((e) =>
        console.error('whoop_webhook process_error', e instanceof Error ? e.message : e),
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
