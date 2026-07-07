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
  // Guarda para qual user_id o papel já foi buscado. Num reload completo o
  // user chega depois do primeiro render; sem isso, o ProtectedRoute decide
  // com papel vazio antes da busca terminar e redireciona para /select-role.
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRoleState(null);
      setFetchedForUserId(null);
      return;
    }

    try {
      // maybeSingle + order: não quebra se o usuário tiver mais de um papel
      // (registro duplicado); o papel de atleta tem precedência
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
      }

      setRoleState((data?.role as AppRole) ?? null);
    } catch (err) {
      console.error('Error fetching role:', err);
    } finally {
      setFetchedForUserId(user.id);
    }
  }, [user]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  // Carregando enquanto a busca do papel do usuário atual não terminou
  const isLoading = !!user && fetchedForUserId !== user.id;

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
