import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StravaConnection, StravaActivity, StravaActivityDetails } from '@/types/strava';

export function useStravaConnection() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<StravaConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!user) {
      setConnection(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('strava_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching Strava connection:', error);
      }
      
      setConnection(data as StravaConnection | null);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const getAuthUrl = async (): Promise<string | null> => {
    try {
      // Pass the current origin so the edge function knows where to redirect back
      const origin = window.location.origin;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?action=authorize&origin=${encodeURIComponent(origin)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const result = await response.json();
      return result.url;
    } catch (err) {
      console.error('Error getting Strava auth URL:', err);
      return null;
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    try {
      const url = await getAuthUrl();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error connecting to Strava:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle the new OAuth callback with tokens in URL
  const handleOAuthCallback = async (params: {
    athleteId: string;
    athleteName: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scope: string;
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?action=save_connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Strava save connection error:', error);
        return false;
      }

      await fetchConnection();
      return true;
    } catch (err) {
      console.error('Error saving Strava connection:', err);
      return false;
    }
  };

  // Legacy callback handler (keeping for backwards compatibility)
  const handleCallback = async (code: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?action=callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, userId: user.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Strava callback error:', error);
        return false;
      }

      await fetchConnection();
      return true;
    } catch (err) {
      console.error('Error handling Strava callback:', err);
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        return false;
      }

      setConnection(null);
      return true;
    } catch (err) {
      console.error('Error disconnecting from Strava:', err);
      return false;
    }
  };

  const handleStravaErrorToast = (code?: string, message?: string) => {
    const label = message || 'Erro ao comunicar com o Strava.';
    if (code === 'strava_app_inactive') {
      toast.error('App Strava inativo', {
        description: 'O app OAuth está desativado no painel de desenvolvedor do Strava. Reative em strava.com/settings/api.',
        duration: 8000,
      });
    } else if (code === 'insufficient_scope' || code === 'strava_unauthorized' || code === 'strava_refresh_failed') {
      toast.error('Reconecte o Strava', { description: label, duration: 7000 });
    } else if (code === 'strava_rate_limited') {
      toast.error('Limite do Strava atingido', { description: label });
    } else if (code === 'strava_not_connected') {
      toast.error('Strava não conectado', { description: label });
    } else {
      toast.error('Falha ao consultar o Strava', { description: label });
    }
  };

  const listActivities = async (opts?: { afterDays?: number }): Promise<StravaActivity[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const qs = new URLSearchParams({ action: 'list' });
      if (opts?.afterDays && opts.afterDays > 0) {
        const afterSec = Math.floor((Date.now() - opts.afterDays * 86400 * 1000) / 1000);
        qs.set('after', String(afterSec));
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-import?${qs.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Strava list error:', result);
        handleStravaErrorToast(result?.error, result?.message);
        return [];
      }

      return result.activities || [];
    } catch (err) {
      console.error('Error listing Strava activities:', err);
      toast.error('Falha de rede ao consultar o Strava');
      return [];
    }
  };

  const getActivityDetails = async (activityId: number): Promise<StravaActivityDetails | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-import?action=details&activity_id=${activityId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Strava details error:', result);
        handleStravaErrorToast(result?.error, result?.message);
        return null;
      }

      return result.activity || null;
    } catch (err) {
      console.error('Error getting activity details:', err);
      return null;
    }
  };

  return {
    connection,
    isLoading,
    isConnecting,
    isConnected: !!connection,
    connect,
    disconnect,
    handleCallback,
    handleOAuthCallback,
    listActivities,
    getActivityDetails,
    refetch: fetchConnection,
  };
}
