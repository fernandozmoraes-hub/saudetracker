import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strava activity types mapped to our workout types.
// Types not present here are preserved as 'other' instead of being dropped.
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
  Walk: 'Walk',
  Hike: 'Hike',
};

// Pagination safety cap
const MAX_PAGES = 5;
const PER_PAGE = 100;

const ZONE_WEIGHTS: Record<number, number> = {
  1: 0.6,
  2: 0.8,
  3: 1.0,
  4: 1.2,
  5: 1.4,
};

interface HrZone {
  zone: number;
  lowerBpm: number;
  upperBpm: number;
}

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

function calculateTimePerZone(hrStream: number[], tStream: number[], zones: HrZone[], totalMin: number) {
  const result = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  for (let i = 1; i < hrStream.length; i++) {
    const duration = (tStream[i] - tStream[i - 1]) / 60;
    const zone = determineZone(hrStream[i], zones);
    result[`z${zone}` as keyof typeof result] += duration;
  }
  const r05 = (n: number) => Math.round(n * 2) / 2;
  const rounded = { z1: r05(result.z1), z2: r05(result.z2), z3: r05(result.z3), z4: r05(result.z4), z5: r05(result.z5) };
  const roundedSum = rounded.z1 + rounded.z2 + rounded.z3 + rounded.z4 + rounded.z5;
  const target = r05(totalMin);
  const diff = target - roundedSum;
  if (diff !== 0) {
    const keys: ('z1' | 'z2' | 'z3' | 'z4' | 'z5')[] = ['z1', 'z2', 'z3', 'z4', 'z5'];
    const largest = keys.reduce((m, k) => (rounded[k] > rounded[m] ? k : m), 'z1' as const);
    rounded[largest] = r05(rounded[largest] + diff);
    if (rounded[largest] < 0) rounded[largest] = 0;
  }
  return rounded;
}

function calculateHrTssByZones(z1: number, z2: number, z3: number, z4: number, z5: number): number {
  const tss =
    ((z1 / 60) * Math.pow(ZONE_WEIGHTS[1], 2) +
      (z2 / 60) * Math.pow(ZONE_WEIGHTS[2], 2) +
      (z3 / 60) * Math.pow(ZONE_WEIGHTS[3], 2) +
      (z4 / 60) * Math.pow(ZONE_WEIGHTS[4], 2) +
      (z5 / 60) * Math.pow(ZONE_WEIGHTS[5], 2)) *
    100;
  return Math.round(tss);
}

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('strava_sync token refresh attempt');
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
    if (!response.ok) {
      console.error('strava_sync refresh_failed status=', response.status);
      throw new Error('refresh_failed');
    }
    const tokenData = await response.json();
    await supabase
      .from('strava_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
      })
      .eq('id', connection.id);
    console.log('strava_sync refresh_success');
    return tokenData.access_token;
  }
  return connection.access_token;
}

// Classify Strava error responses (Application Inactive, scope, auth)
function classifyStravaError(status: number, bodyText: string): { code: string; message: string; httpStatus: number } {
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText); } catch { /* noop */ }
  const errs: any[] = parsed?.errors || [];
  const inactive = errs.some((e) => e?.code === 'Inactive' && e?.field === 'Status');
  if (inactive) {
    return {
      code: 'strava_app_inactive',
      message: 'O app Strava está inativo no painel de desenvolvedor. Reative o app em strava.com/settings/api e tente novamente.',
      httpStatus: 503,
    };
  }
  if (status === 401) {
    return {
      code: 'strava_unauthorized',
      message: 'Sessão do Strava expirou ou foi revogada. Reconecte sua conta.',
      httpStatus: 401,
    };
  }
  if (status === 403) {
    return {
      code: 'strava_forbidden',
      message: 'Strava recusou a solicitação (403). Verifique permissões e status do app.',
      httpStatus: 403,
    };
  }
  if (status === 429) {
    return {
      code: 'strava_rate_limited',
      message: 'Limite de requisições do Strava atingido. Tente novamente mais tarde.',
      httpStatus: 429,
    };
  }
  return {
    code: 'strava_upstream_error',
    message: `Erro na API do Strava (${status}).`,
    httpStatus: 502,
  };
}

function toEpochSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // If caller mistakenly sent milliseconds, coerce to seconds.
  return n > 10_000_000_000 ? Math.floor(n / 1000) : Math.floor(n);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const { data: connection, error: connError } = await supabase
      .from('strava_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'strava_not_connected', message: 'Conecte sua conta Strava para importar treinos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Scope validation
    const scopes = (connection.scope || '').toString();
    const hasReadAll = scopes.includes('activity:read_all') || scopes.includes('activity:read');
    if (!hasReadAll) {
      console.warn('strava_sync insufficient_scope userId=', user.id, 'scopes=', scopes);
      return new Response(
        JSON.stringify({
          error: 'insufficient_scope',
          message: 'Reconecte o Strava concedendo permissão de leitura de atividades.',
          scopes,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let accessToken: string;
    const tokenExpired = new Date(connection.expires_at).getTime() < Date.now();
    try {
      accessToken = await refreshTokenIfNeeded(supabase, connection);
    } catch (_e) {
      return new Response(
        JSON.stringify({
          error: 'strava_refresh_failed',
          message: 'Não foi possível renovar o token do Strava. Reconecte sua conta.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ============= LIST =============
    if (action === 'list') {
      const after = toEpochSeconds(url.searchParams.get('after'));
      const before = toEpochSeconds(url.searchParams.get('before'));

      console.log('strava_sync list_start', JSON.stringify({
        userId: user.id,
        hasToken: !!accessToken,
        tokenExpired,
        scopes,
        requestAfter: after,
        requestBefore: before,
        perPage: PER_PAGE,
        maxPages: MAX_PAGES,
      }));

      const all: any[] = [];
      let lastStatus = 0;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const qs = new URLSearchParams();
        qs.set('per_page', String(PER_PAGE));
        qs.set('page', String(page));
        if (after !== null) qs.set('after', String(after));
        if (before !== null) qs.set('before', String(before));

        const resp = await fetch(`https://www.strava.com/api/v3/athlete/activities?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        lastStatus = resp.status;

        if (!resp.ok) {
          const errText = await resp.text();
          const cls = classifyStravaError(resp.status, errText);
          console.error('strava_sync list_error', JSON.stringify({
            userId: user.id, page, responseStatus: resp.status, code: cls.code,
          }));
          return new Response(
            JSON.stringify({ error: cls.code, message: cls.message, responseStatus: resp.status }),
            { status: cls.httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        const pageData = await resp.json();
        if (!Array.isArray(pageData) || pageData.length === 0) break;
        all.push(...pageData);
        if (pageData.length < PER_PAGE) break;
      }

      const formatted = all.map((a: any) => {
        const mapped = ACTIVITY_TYPE_MAP[a.type] || ACTIVITY_TYPE_MAP[a.sport_type];
        return {
          id: a.id,
          name: a.name,
          type: mapped || 'other',
          stravaType: a.type,
          sportType: a.sport_type ?? null,
          date: a.start_date_local ? a.start_date_local.split('T')[0] : null,
          durationMin: a.moving_time ? Math.round((a.moving_time / 60) * 10) / 10 : 0,
          distanceKm: a.distance ? Math.round((a.distance / 1000) * 100) / 100 : null,
          avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
          hasHeartrate: !!a.has_heartrate,
          supported: !!mapped,
        };
      });

      console.log('strava_sync list_success', JSON.stringify({
        userId: user.id,
        responseStatus: lastStatus,
        activitiesReturned: formatted.length,
        firstActivityDate: formatted[0]?.date || null,
        lastActivityDate: formatted[formatted.length - 1]?.date || null,
      }));

      return new Response(
        JSON.stringify({ activities: formatted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ============= DETAILS =============
    if (action === 'details') {
      const activityId = url.searchParams.get('activity_id');
      if (!activityId) {
        return new Response(JSON.stringify({ error: 'activity_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('strava_sync details_start', JSON.stringify({ userId: user.id, activityId }));

      const { data: settings } = await supabase
        .from('user_settings')
        .select('lthr, zone1_upper_pct, zone2_upper_pct, zone3_upper_pct, zone4_upper_pct')
        .eq('user_id', user.id)
        .single();

      const lthr = settings?.lthr || 165;
      const z1 = settings?.zone1_upper_pct || 84;
      const z2 = settings?.zone2_upper_pct || 89;
      const z3 = settings?.zone3_upper_pct || 94;
      const z4 = settings?.zone4_upper_pct || 99;

      const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!activityResponse.ok) {
        const errText = await activityResponse.text();
        const cls = classifyStravaError(activityResponse.status, errText);
        console.error('strava_sync details_error', JSON.stringify({
          userId: user.id, activityId, responseStatus: activityResponse.status, code: cls.code,
        }));
        return new Response(
          JSON.stringify({ error: cls.code, message: cls.message }),
          { status: cls.httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const activity = await activityResponse.json();
      const mapped = ACTIVITY_TYPE_MAP[activity.type] || ACTIVITY_TYPE_MAP[activity.sport_type];

      const result: any = {
        id: activity.id,
        name: activity.name,
        type: mapped || 'other',
        stravaType: activity.type,
        sportType: activity.sport_type ?? null,
        date: activity.start_date_local ? activity.start_date_local.split('T')[0] : null,
        durationMin: activity.moving_time ? Math.round((activity.moving_time / 60) * 10) / 10 : 0,
        distanceKm: activity.distance ? Math.round((activity.distance / 1000) * 100) / 100 : null,
        avgHr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        maxHr: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
        hasHeartrate: !!activity.has_heartrate,
        supported: !!mapped,
        zones: null,
        tss: null,
        tssMethod: null,
      };

      if (activity.has_heartrate) {
        const streamResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,time&key_by_type=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (streamResponse.ok) {
          const streamData = await streamResponse.json();
          if (streamData.heartrate?.data && streamData.time?.data) {
            const zones = calculateZones(lthr, z1, z2, z3, z4);
            const timePerZone = calculateTimePerZone(streamData.heartrate.data, streamData.time.data, zones, result.durationMin);
            result.zones = timePerZone;
            result.tss = calculateHrTssByZones(timePerZone.z1, timePerZone.z2, timePerZone.z3, timePerZone.z4, timePerZone.z5);
            result.tssMethod = 'HR_zones';
            result.lthrUsed = lthr;
          }
        }
      }

      if (!result.tss && result.avgHr) {
        const IF = result.avgHr / lthr;
        result.tss = Math.round((result.durationMin / 60) * Math.pow(IF, 2) * 100);
        result.tssMethod = 'HR_avg';
        result.lthrUsed = lthr;
      }

      return new Response(JSON.stringify({ activity: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('strava_sync uncaught_error', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
