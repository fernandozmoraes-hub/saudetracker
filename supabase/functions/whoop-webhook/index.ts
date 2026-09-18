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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CLAIM_STALE_MS = 30_000; // se uma invocação morrer com o claim preso, libera depois disso
const CLAIM_WAIT_ATTEMPTS = 8;
const CLAIM_WAIT_INTERVAL_MS = 500;

/**
 * Renova o access_token se necessário. A WHOOP envia recovery.updated e sleep.updated quase
 * juntos para o mesmo evento, disparando duas invocações concorrentes deste webhook. Como o
 * refresh_token é de uso único, duas chamadas simultâneas à WHOOP com o mesmo refresh_token
 * fazem AMBAS falharem com 400 (a WHOOP invalida o token inteiro ao detectar reuso
 * concorrente) — não existe "vencedor" pra uma reconferência posterior detectar. Por isso,
 * antes de chamar a WHOOP, cada invocação tenta reivindicar o direito exclusivo de renovar
 * via um UPDATE condicional atômico (só uma consegue). Quem não conseguir espera a vencedora
 * terminar e reusa o token que ela renovou, em vez de chamar a WHOOP também.
 */
async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.expires_at);
  if (expiresAt.getTime() - Date.now() >= 5 * 60 * 1000) {
    return connection.access_token;
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  const soon = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const { data: claimed } = await supabase
    .from('whoop_connections')
    .update({ refresh_claimed_at: now.toISOString() })
    .eq('id', connection.id)
    .lt('expires_at', soon)
    .or(`refresh_claimed_at.is.null,refresh_claimed_at.lt.${staleBefore}`)
    .select('refresh_token')
    .maybeSingle();

  if (!claimed) {
    // Outra invocação já está renovando (ou já terminou) — espera e reusa o resultado dela
    // em vez de arriscar uma segunda chamada concorrente à WHOOP.
    for (let i = 0; i < CLAIM_WAIT_ATTEMPTS; i++) {
      const { data: fresh } = await supabase
        .from('whoop_connections')
        .select('access_token, expires_at')
        .eq('id', connection.id)
        .maybeSingle();
      if (fresh && new Date(fresh.expires_at).getTime() - Date.now() >= 5 * 60 * 1000) {
        return fresh.access_token;
      }
      await sleep(CLAIM_WAIT_INTERVAL_MS);
    }
    throw new Error('whoop_refresh_wait_timeout');
  }

  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: claimed.refresh_token,
        client_id: WHOOP_CLIENT_ID!,
        client_secret: WHOOP_CLIENT_SECRET!,
        scope: 'offline',
      }),
    });
    if (!response.ok) {
      // Falha real (não é corrida — só esta invocação tinha o direito de renovar): o
      // refresh_token não é mais válido. Marca a conexão pro Settings parar de mostrar
      // "conectado" e o usuário precisar reautorizar.
      await supabase
        .from('whoop_connections')
        .update({ needs_reauth: true, refresh_claimed_at: null, updated_at: new Date().toISOString() })
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
        refresh_claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    return tokenData.access_token;
  } catch (err) {
    // Garante que o claim não fique preso até CLAIM_STALE_MS em erros inesperados (rede, etc.)
    await supabase
      .from('whoop_connections')
      .update({ refresh_claimed_at: null })
      .eq('id', connection.id);
    throw err;
  }
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
