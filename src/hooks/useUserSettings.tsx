import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserSettings } from '@/types/health';
import { DEFAULT_LTHR } from '@/lib/calculations';

interface UserSettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateLthr: (lthr: number) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({ lthr: DEFAULT_LTHR });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings({ lthr: DEFAULT_LTHR });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user settings:', error);
        setSettings({ lthr: DEFAULT_LTHR });
      } else if (data) {
        setSettings({
          id: data.id,
          userId: data.user_id,
          lthr: data.lthr ?? DEFAULT_LTHR,
        });
      } else {
        // No settings found, use defaults
        setSettings({ lthr: DEFAULT_LTHR });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSettings({ lthr: DEFAULT_LTHR });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateLthr = useCallback(async (lthr: number): Promise<boolean> => {
    if (!user) return false;

    // Validate LTHR range (reasonable HR values)
    if (lthr < 100 || lthr > 220) {
      console.error('LTHR must be between 100 and 220 bpm');
      return false;
    }

    try {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('user_settings')
          .update({ lthr, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_settings')
          .insert({ user_id: user.id, lthr });

        if (error) throw error;
      }

      setSettings(prev => ({ ...prev, lthr }));
      return true;
    } catch (err) {
      console.error('Error updating LTHR:', err);
      return false;
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <UserSettingsContext.Provider value={{
      settings,
      isLoading,
      updateLthr,
      refreshSettings: fetchSettings,
    }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
