import { useState, useEffect, useCallback } from 'react';
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
      const redirectUri = `${window.location.origin}/settings?strava_callback=true`;
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: null,
        headers: {},
      });

      // Use query params for GET-like request
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
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

  const listActivities = async (): Promise<StravaActivity[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-import?action=list`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list activities');
      }

      const result = await response.json();
      return result.activities || [];
    } catch (err) {
      console.error('Error listing Strava activities:', err);
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

      if (!response.ok) {
        throw new Error('Failed to get activity details');
      }

      const result = await response.json();
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
    listActivities,
    getActivityDetails,
    refetch: fetchConnection,
  };
}
