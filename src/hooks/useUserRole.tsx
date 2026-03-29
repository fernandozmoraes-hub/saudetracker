import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'coach' | 'athlete';

interface UserRoleContextType {
  role: AppRole | null;
  isCoach: boolean;
  isAthlete: boolean;
  isLoading: boolean;
  hasRole: boolean;
  setRole: (newRole: AppRole) => Promise<boolean>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRoleState(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching role:', error);
      }

      setRoleState((data?.role as AppRole) ?? null);
    } catch (err) {
      console.error('Error fetching role:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const setRole = async (newRole: AppRole): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: user.id, role: newRole },
        { onConflict: 'user_id,role', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Error setting role:', error);
      return false;
    }

    setRoleState(newRole);
    return true;
  };

  return (
    <UserRoleContext.Provider value={{
      role,
      isCoach: role === 'coach',
      isAthlete: role === 'athlete' || role === null,
      isLoading,
      hasRole: role !== null,
      setRole,
    }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
