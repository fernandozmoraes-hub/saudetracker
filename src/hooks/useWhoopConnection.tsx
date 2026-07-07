import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { WhoopConnection } from '@/types/whoop';

export function useWhoopConnection() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<WhoopConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!user) {
      setConnection(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('whoop_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching Whoop connection:', error);
      }
      setConnection(data as WhoopConnection | null);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const origin = window.location.origin;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whoop-auth?action=authorize&origin=${encodeURIComponent(origin)}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!response.ok) throw new Error('Failed to get auth URL');
      const result = await response.json();
      if (result.url) window.location.href = result.url;
    } catch (err) {
      console.error('Error connecting to Whoop:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (params: {
    whoopUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    scope: string;
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whoop-auth?action=save_connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Whoop save connection error:', error);
        return false;
      }

      await fetchConnection();
      return true;
    } catch (err) {
      console.error('Error saving Whoop connection:', err);
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whoop-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) return false;
      setConnection(null);
      return true;
    } catch (err) {
      console.error('Error disconnecting from Whoop:', err);
      return false;
    }
  };

  return {
    connection,
    isLoading,
    isConnecting,
    isConnected: !!connection,
    connect,
    handleOAuthCallback,
    disconnect,
  };
}
