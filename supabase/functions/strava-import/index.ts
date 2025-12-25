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

// Strava activity types mapped to our workout types
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  'Run': 'Run',
  'VirtualRun': 'Run',
  'TrailRun': 'Run',
  'Ride': 'Bike',
  'VirtualRide': 'Bike',
  'MountainBikeRide': 'Bike',
  'GravelRide': 'Bike',
  'EBikeRide': 'Bike',
  'WeightTraining': 'Strength',
  'Workout': 'Strength',
};

// Zone weights based on TrainingPeaks model
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

function calculateZones(lthr: number, zone1UpperPct: number, zone2UpperPct: number, zone3UpperPct: number, zone4UpperPct: number): HrZone[] {
  return [
    { zone: 1, lowerBpm: 0, upperBpm: Math.round(lthr * zone1UpperPct / 100) },
    { zone: 2, lowerBpm: Math.round(lthr * (zone1UpperPct + 1) / 100), upperBpm: Math.round(lthr * zone2UpperPct / 100) },
    { zone: 3, lowerBpm: Math.round(lthr * (zone2UpperPct + 1) / 100), upperBpm: Math.round(lthr * zone3UpperPct / 100) },
    { zone: 4, lowerBpm: Math.round(lthr * (zone3UpperPct + 1) / 100), upperBpm: Math.round(lthr * zone4UpperPct / 100) },
    { zone: 5, lowerBpm: Math.round(lthr * (zone4UpperPct + 1) / 100), upperBpm: 999 },
  ];
}

function determineZone(hr: number, zones: HrZone[]): number {
  for (const z of zones) {
    if (hr <= z.upperBpm) return z.zone;
  }
  return 5;
}

function calculateTimePerZone(
  heartrateStream: number[],
  timeStream: number[],
  zones: HrZone[]
): { z1: number; z2: number; z3: number; z4: number; z5: number } {
  const result = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

  for (let i = 1; i < heartrateStream.length; i++) {
    const hr = heartrateStream[i];
    const duration = (timeStream[i] - timeStream[i - 1]) / 60; // minutes
    const zone = determineZone(hr, zones);
    result[`z${zone}` as keyof typeof result] += duration;
  }

  // Round to 1 decimal
  return {
    z1: Math.round(result.z1 * 10) / 10,
    z2: Math.round(result.z2 * 10) / 10,
    z3: Math.round(result.z3 * 10) / 10,
    z4: Math.round(result.z4 * 10) / 10,
    z5: Math.round(result.z5 * 10) / 10,
  };
}

function calculateHrTssByZones(timeZ1: number, timeZ2: number, timeZ3: number, timeZ4: number, timeZ5: number): number {
  const z1Hours = timeZ1 / 60;
  const z2Hours = timeZ2 / 60;
  const z3Hours = timeZ3 / 60;
  const z4Hours = timeZ4 / 60;
  const z5Hours = timeZ5 / 60;

  const tss = (
    z1Hours * Math.pow(ZONE_WEIGHTS[1], 2) +
    z2Hours * Math.pow(ZONE_WEIGHTS[2], 2) +
    z3Hours * Math.pow(ZONE_WEIGHTS[3], 2) +
    z4Hours * Math.pow(ZONE_WEIGHTS[4], 2) +
    z5Hours * Math.pow(ZONE_WEIGHTS[5], 2)
  ) * 100;

  return Math.round(tss);
}

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');

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
      throw new Error('Failed to refresh token');
    }

    const tokenData = await response.json();

    // Update tokens in database
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get user's Strava connection
    const { data: connection, error: connError } = await supabase
      .from('strava_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Strava not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fresh access token
    const accessToken = await refreshTokenIfNeeded(supabase, connection);

    // List recent activities
    if (action === 'list') {
      console.log('Fetching recent activities from Strava...');

      const activitiesResponse = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?per_page=20',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!activitiesResponse.ok) {
        const error = await activitiesResponse.text();
        console.error('Strava activities error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch activities' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const activities = await activitiesResponse.json();

      // Filter to supported activity types and format
      const formattedActivities = activities
        .filter((a: any) => ACTIVITY_TYPE_MAP[a.type])
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          type: ACTIVITY_TYPE_MAP[a.type] || 'Run',
          stravaType: a.type,
          date: a.start_date_local.split('T')[0],
          durationMin: Math.round(a.moving_time / 60 * 10) / 10,
          distanceKm: a.distance ? Math.round(a.distance / 1000 * 100) / 100 : null,
          avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          hasHeartrate: a.has_heartrate,
        }));

      return new Response(
        JSON.stringify({ activities: formattedActivities }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get activity details with HR stream for zone calculation
    if (action === 'details') {
      const activityId = url.searchParams.get('activity_id');
      
      if (!activityId) {
        return new Response(
          JSON.stringify({ error: 'activity_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching activity details:', activityId);

      // Get user settings for zone calculation
      const { data: settings } = await supabase
        .from('user_settings')
        .select('lthr, zone1_upper_pct, zone2_upper_pct, zone3_upper_pct, zone4_upper_pct')
        .eq('user_id', user.id)
        .single();

      const lthr = settings?.lthr || 165;
      const zone1UpperPct = settings?.zone1_upper_pct || 84;
      const zone2UpperPct = settings?.zone2_upper_pct || 89;
      const zone3UpperPct = settings?.zone3_upper_pct || 94;
      const zone4UpperPct = settings?.zone4_upper_pct || 99;

      // Fetch activity
      const activityResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!activityResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch activity' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const activity = await activityResponse.json();

      const result: any = {
        id: activity.id,
        name: activity.name,
        type: ACTIVITY_TYPE_MAP[activity.type] || 'Run',
        stravaType: activity.type,
        date: activity.start_date_local.split('T')[0],
        durationMin: Math.round(activity.moving_time / 60 * 10) / 10,
        distanceKm: activity.distance ? Math.round(activity.distance / 1000 * 100) / 100 : null,
        avgHr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        hasHeartrate: activity.has_heartrate,
        zones: null,
        tss: null,
        tssMethod: null,
      };

      // Try to get HR stream if activity has heartrate
      if (activity.has_heartrate) {
        console.log('Fetching HR stream...');
        
        const streamResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,time&key_by_type=true`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (streamResponse.ok) {
          const streamData = await streamResponse.json();
          
          if (streamData.heartrate?.data && streamData.time?.data) {
            const zones = calculateZones(lthr, zone1UpperPct, zone2UpperPct, zone3UpperPct, zone4UpperPct);
            const timePerZone = calculateTimePerZone(
              streamData.heartrate.data,
              streamData.time.data,
              zones
            );

            result.zones = timePerZone;
            result.tss = calculateHrTssByZones(
              timePerZone.z1,
              timePerZone.z2,
              timePerZone.z3,
              timePerZone.z4,
              timePerZone.z5
            );
            result.tssMethod = 'HR_zones';
            result.lthrUsed = lthr;
          }
        }
      }

      // Fallback to HR_avg TSS if no stream
      if (!result.tss && result.avgHr) {
        const IF = result.avgHr / lthr;
        result.tss = Math.round((result.durationMin / 60) * Math.pow(IF, 2) * 100);
        result.tssMethod = 'HR_avg';
        result.lthrUsed = lthr;
      }

      return new Response(
        JSON.stringify({ activity: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in strava-import:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
