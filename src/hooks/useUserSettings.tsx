import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserSettings } from '@/types/health';
import { DEFAULT_LTHR, DEFAULT_ZONE_THRESHOLDS } from '@/lib/calculations';

interface UserSettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateLthr: (lthr: number) => Promise<boolean>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

const getDefaultSettings = (): UserSettings => ({
  lthr: DEFAULT_LTHR,
  zone1UpperPct: DEFAULT_ZONE_THRESHOLDS.zone1UpperPct,
  zone2UpperPct: DEFAULT_ZONE_THRESHOLDS.zone2UpperPct,
  zone3UpperPct: DEFAULT_ZONE_THRESHOLDS.zone3UpperPct,
  zone4UpperPct: DEFAULT_ZONE_THRESHOLDS.zone4UpperPct,
});

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(getDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(getDefaultSettings());
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
        setSettings(getDefaultSettings());
      } else if (data) {
        setSettings({
          id: data.id,
          userId: data.user_id,
          lthr: data.lthr ?? DEFAULT_LTHR,
          restingHr: (data as any).resting_hr ?? undefined,
          maxHr: (data as any).max_hr ?? undefined,
          zone1UpperPct: (data as any).zone1_upper_pct ?? DEFAULT_ZONE_THRESHOLDS.zone1UpperPct,
          zone2UpperPct: (data as any).zone2_upper_pct ?? DEFAULT_ZONE_THRESHOLDS.zone2UpperPct,
          zone3UpperPct: (data as any).zone3_upper_pct ?? DEFAULT_ZONE_THRESHOLDS.zone3UpperPct,
          zone4UpperPct: (data as any).zone4_upper_pct ?? DEFAULT_ZONE_THRESHOLDS.zone4UpperPct,
        });
      } else {
        // No settings found, use defaults
        setSettings(getDefaultSettings());
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSettings(getDefaultSettings());
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateLthr = useCallback(async (lthr: number): Promise<boolean> => {
    return updateSettings({ lthr });
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>): Promise<boolean> => {
    if (!user) return false;

    // Validate LTHR range if provided
    if (newSettings.lthr !== undefined && (newSettings.lthr < 100 || newSettings.lthr > 220)) {
      console.error('LTHR must be between 100 and 220 bpm');
      return false;
    }

    try {
      // Build the update object with snake_case keys
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (newSettings.lthr !== undefined) updateData.lthr = newSettings.lthr;
      if (newSettings.restingHr !== undefined) updateData.resting_hr = newSettings.restingHr;
      if (newSettings.maxHr !== undefined) updateData.max_hr = newSettings.maxHr;
      if (newSettings.zone1UpperPct !== undefined) updateData.zone1_upper_pct = newSettings.zone1UpperPct;
      if (newSettings.zone2UpperPct !== undefined) updateData.zone2_upper_pct = newSettings.zone2UpperPct;
      if (newSettings.zone3UpperPct !== undefined) updateData.zone3_upper_pct = newSettings.zone3UpperPct;
      if (newSettings.zone4UpperPct !== undefined) updateData.zone4_upper_pct = newSettings.zone4UpperPct;

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
          .update(updateData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new with all settings
        const insertData = {
          user_id: user.id,
          lthr: newSettings.lthr ?? DEFAULT_LTHR,
          resting_hr: newSettings.restingHr ?? null,
          max_hr: newSettings.maxHr ?? null,
          zone1_upper_pct: newSettings.zone1UpperPct ?? DEFAULT_ZONE_THRESHOLDS.zone1UpperPct,
          zone2_upper_pct: newSettings.zone2UpperPct ?? DEFAULT_ZONE_THRESHOLDS.zone2UpperPct,
          zone3_upper_pct: newSettings.zone3UpperPct ?? DEFAULT_ZONE_THRESHOLDS.zone3UpperPct,
          zone4_upper_pct: newSettings.zone4UpperPct ?? DEFAULT_ZONE_THRESHOLDS.zone4UpperPct,
        };

        const { error } = await supabase
          .from('user_settings')
          .insert(insertData);

        if (error) throw error;
      }

      setSettings(prev => ({ ...prev, ...newSettings }));
      return true;
    } catch (err) {
      console.error('Error updating settings:', err);
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
      updateSettings,
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
