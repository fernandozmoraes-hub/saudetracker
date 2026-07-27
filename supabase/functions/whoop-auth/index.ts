import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';
const SCOPES = 'read:recovery read:sleep read:profile offline';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Sem action mas com code/error na URL = retorno do OAuth do WHOOP
    // (a redirect URI registrada no WHOOP é a URL limpa desta função)
    let action = url.searchParams.get('action');
    if (!action && (url.searchParams.get('code') || url.searchParams.get('error'))) {
      action = 'oauth_callback';
    }

    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'whoop_not_configured', message: 'WHOOP_CLIENT_ID/WHOOP_CLIENT_SECRET não configurados.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Gera a URL de autorização do WHOOP
    if (action === 'authorize') {
      const frontendOrigin = url.searchParams.get('origin') || 'https://saudetracker.lovable.app';
      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth`;

      const authUrl = new URL(WHOOP_AUTH_URL);
      authUrl.searchParams.set('client_id', WHOOP_CLIENT_ID);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', SCOPES);
      // WHOOP exige state com no mínimo 8 caracteres; carregamos a origin do frontend nele
      authUrl.searchParams.set('state', frontendOrigin);

      return new Response(
        JSON.stringify({ url: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Callback do OAuth - WHOOP redireciona aqui com o code
    if (action === 'oauth_callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || 'https://saudetracker.lovable.app';
      const error = url.searchParams.get('error');

      const frontendUrl = new URL('/settings', state);

      if (error) {
        console.error('WHOOP OAuth error:', error);
        frontendUrl.searchParams.set('whoop_error', error);
        return Response.redirect(frontendUrl.toString(), 302);
      }
      if (!code) {
        frontendUrl.searchParams.set('whoop_error', 'no_code');
        return Response.redirect(frontendUrl.toString(), 302);
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth`;
      const tokenResponse = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: WHOOP_CLIENT_ID,
          client_secret: WHOOP_CLIENT_SECRET,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error('WHOOP token exchange failed:', errText);
        frontendUrl.searchParams.set('whoop_error', 'token_exchange_failed');
        return Response.redirect(frontendUrl.toString(), 302);
      }

      const tokenData = await tokenResponse.json();

      // Busca o perfil para obter o whoop_user_id (necessário para casar eventos do webhook)
      const profileResponse = await fetch(`${WHOOP_API_BASE}/v2/user/profile/basic`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileResponse.ok) {
        console.error('WHOOP profile fetch failed:', profileResponse.status);
        frontendUrl.searchParams.set('whoop_error', 'profile_fetch_failed');
        return Response.redirect(frontendUrl.toString(), 302);
      }
      const profile = await profileResponse.json();

      console.log('WHOOP token exchange successful, user:', profile.user_id);

      frontendUrl.searchParams.set('whoop_success', 'true');
      frontendUrl.searchParams.set('whoop_user_id', String(profile.user_id));
      frontendUrl.searchParams.set('whoop_access_token', tokenData.access_token);
      frontendUrl.searchParams.set('whoop_refresh_token', tokenData.refresh_token);
      frontendUrl.searchParams.set('whoop_expires_in', String(tokenData.expires_in));
      frontendUrl.searchParams.set('whoop_scope', tokenData.scope || SCOPES);

      return Response.redirect(frontendUrl.toString(), 302);
    }

    // Salva a conexão (chamado pelo frontend autenticado após o oauth_callback)
    if (action === 'save_connection') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const expiresAt = new Date(Date.now() + Number(body.expiresIn || 3600) * 1000).toISOString();

      const { error: upsertError } = await supabase
        .from('whoop_connections')
        .upsert({
          user_id: user.id,
          whoop_user_id: Number(body.whoopUserId),
          access_token: body.accessToken,
          refresh_token: body.refreshToken,
          expires_at: expiresAt,
          scope: body.scope,
          needs_reauth: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Error saving whoop connection:', upsertError);
        return new Response(JSON.stringify({ error: 'save_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Desconecta
    if (action === 'disconnect') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: deleteError } = await supabase
        .from('whoop_connections')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: 'delete_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('whoop_auth uncaught_error', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
