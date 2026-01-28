import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Equipment, EquipmentStatus } from '@/types/health';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface EquipmentContextType {
  equipment: Equipment[];
  isLoading: boolean;
  refreshEquipment: () => Promise<void>;
  saveEquipment: (equipment: Omit<Equipment, 'id' | 'userId' | 'totalKm' | 'status' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
  deleteEquipment: (id: string) => Promise<boolean>;
  retireEquipment: (id: string) => Promise<boolean>;
  getActiveEquipment: () => Equipment[];
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEquipment = useCallback(async () => {
    if (!user) {
      setEquipment([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const equipmentList: Equipment[] = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        brand: row.brand ?? undefined,
        startDate: row.start_date,
        totalKm: Number(row.total_km),
        maxKm: Number(row.max_km),
        status: row.status as EquipmentStatus,
        activeForSelection: row.active_for_selection,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      setEquipment(equipmentList);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const saveEquipment = async (eq: Omit<Equipment, 'id' | 'userId' | 'totalKm' | 'status' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<boolean> => {
    if (!user) return false;

    const isNewEquipment = !eq.id || eq.id === '' || !eq.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    if (isNewEquipment) {
      const { error } = await supabase
        .from('equipment')
        .insert({
          user_id: user.id,
          name: eq.name,
          brand: eq.brand ?? null,
          start_date: eq.startDate,
          max_km: eq.maxKm,
          active_for_selection: eq.activeForSelection,
        });

      if (error) {
        console.error('Error saving equipment:', error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('equipment')
        .update({
          name: eq.name,
          brand: eq.brand ?? null,
          start_date: eq.startDate,
          max_km: eq.maxKm,
          active_for_selection: eq.activeForSelection,
        })
        .eq('id', eq.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating equipment:', error);
        return false;
      }
    }

    await fetchEquipment();
    return true;
  };

  const deleteEquipment = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting equipment:', error);
      return false;
    }

    await fetchEquipment();
    return true;
  };

  const retireEquipment = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('equipment')
      .update({
        status: 'retired',
        active_for_selection: false,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error retiring equipment:', error);
      return false;
    }

    await fetchEquipment();
    return true;
  };

  const getActiveEquipment = (): Equipment[] => {
    return equipment.filter(e => e.activeForSelection);
  };

  return (
    <EquipmentContext.Provider value={{
      equipment,
      isLoading,
      refreshEquipment: fetchEquipment,
      saveEquipment,
      deleteEquipment,
      retireEquipment,
      getActiveEquipment,
    }}>
      {children}
    </EquipmentContext.Provider>
  );
}

export function useEquipment() {
  const context = useContext(EquipmentContext);
  if (context === undefined) {
    throw new Error('useEquipment must be used within an EquipmentProvider');
  }
  return context;
}

// Helper function to calculate wear percentage
export function calculateWearPercentage(totalKm: number, maxKm: number): number {
  return maxKm > 0 ? (totalKm / maxKm) * 100 : 0;
}

// Helper function to get status color classes
export function getStatusColorClasses(status: EquipmentStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'active':
      return { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' };
    case 'attention':
      return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' };
    case 'retired':
      return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' };
  }
}

// Helper function to get status label
export function getStatusLabel(status: EquipmentStatus): string {
  switch (status) {
    case 'active': return 'Ativo';
    case 'attention': return 'Atenção';
    case 'retired': return 'Aposentado';
  }
}
