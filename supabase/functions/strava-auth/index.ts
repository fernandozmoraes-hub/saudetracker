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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Generate OAuth URL for Strava authorization
    if (action === 'authorize') {
      const frontendOrigin = url.searchParams.get('origin') || 'https://lovable.app';
      
      // The redirect_uri is this edge function with oauth_callback action
      const redirectUri = `${SUPABASE_URL}/functions/v1/strava-auth?action=oauth_callback`;
      
      const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
      stravaAuthUrl.searchParams.set('client_id', STRAVA_CLIENT_ID!);
      stravaAuthUrl.searchParams.set('response_type', 'code');
      stravaAuthUrl.searchParams.set('redirect_uri', redirectUri);
      stravaAuthUrl.searchParams.set('scope', 'read,activity:read_all');
      stravaAuthUrl.searchParams.set('approval_prompt', 'auto');
      // Pass the frontend origin in state so we know where to redirect back
      stravaAuthUrl.searchParams.set('state', frontendOrigin);

      console.log('Generated Strava auth URL with redirect to edge function');

      return new Response(
        JSON.stringify({ url: stravaAuthUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OAuth callback - Strava redirects here with the code
    if (action === 'oauth_callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || 'https://lovable.app';
      const error = url.searchParams.get('error');
      
      // Reconstruct frontend URL
      const frontendUrl = new URL('/settings', state);

      if (error) {
        console.error('Strava OAuth error:', error);
        frontendUrl.searchParams.set('strava_error', error);
        return Response.redirect(frontendUrl.toString(), 302);
      }

      if (!code) {
        console.error('No code received from Strava');
        frontendUrl.searchParams.set('strava_error', 'no_code');
        return Response.redirect(frontendUrl.toString(), 302);
      }

      console.log('Received OAuth callback, exchanging code for tokens...');

      // Exchange code for tokens with Strava
      const redirectUri = `${SUPABASE_URL}/functions/v1/strava-auth?action=oauth_callback`;
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Strava token exchange failed:', errorText);
        frontendUrl.searchParams.set('strava_error', 'token_exchange_failed');
        return Response.redirect(frontendUrl.toString(), 302);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful, athlete:', tokenData.athlete?.firstname);

      // Store tokens temporarily - the frontend will need to associate with user
      // We'll encode essential data in the redirect URL (securely via query params)
      frontendUrl.searchParams.set('strava_success', 'true');
      frontendUrl.searchParams.set('strava_athlete_id', tokenData.athlete.id.toString());
      frontendUrl.searchParams.set('strava_athlete_name', `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`);
      frontendUrl.searchParams.set('strava_access_token', tokenData.access_token);
      frontendUrl.searchParams.set('strava_refresh_token', tokenData.refresh_token);
      frontendUrl.searchParams.set('strava_expires_at', tokenData.expires_at.toString());
      frontendUrl.searchParams.set('strava_scope', tokenData.scope || 'read,activity:read_all');

      console.log('Redirecting back to frontend with tokens');
      return Response.redirect(frontendUrl.toString(), 302);
    }

    // Save Strava connection (called from frontend after oauth_callback)
    if (action === 'save_connection') {
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

      const body = await req.json();
      const { athleteId, athleteName, accessToken, refreshToken, expiresAt, scope } = body;

      if (!athleteId || !accessToken || !refreshToken || !expiresAt) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: upsertError } = await supabase
        .from('strava_connections')
        .upsert({
          user_id: user.id,
          strava_athlete_id: parseInt(athleteId),
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(parseInt(expiresAt) * 1000).toISOString(),
          scope: scope || 'read,activity:read_all',
          athlete_name: athleteName,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Database error:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save connection', details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy callback (keeping for backwards compatibility)
    if (action === 'callback') {
      const { code, userId } = await req.json();

      if (!code || !userId) {
        return new Response(
          JSON.stringify({ error: 'code and userId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Legacy callback: Exchanging code for tokens...');

      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Strava token error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for tokens', details: error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful, athlete:', tokenData.athlete?.firstname);

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      const { error: upsertError } = await supabase
        .from('strava_connections')
        .upsert({
          user_id: userId,
          strava_athlete_id: tokenData.athlete.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
          scope: tokenData.scope || 'read,activity:read_all',
          athlete_name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Database error:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save connection', details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          athlete: {
            id: tokenData.athlete.id,
            name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disconnect Strava
    if (action === 'disconnect') {
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

      // Get current connection to revoke token
      const { data: connection } = await supabase
        .from('strava_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .single();

      if (connection?.access_token) {
        try {
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${connection.access_token}` },
          });
        } catch (e) {
          console.log('Token revocation failed (non-blocking):', e);
        }
      }

      const { error: deleteError } = await supabase
        .from('strava_connections')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect', details: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in strava-auth:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
