-- Criar tabela equipment para gerenciar tênis de corrida
CREATE TABLE public.equipment (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_km NUMERIC NOT NULL DEFAULT 0,
    max_km NUMERIC NOT NULL DEFAULT 600,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'attention', 'retired')),
    active_for_selection BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna equipment_id na tabela workouts
ALTER TABLE public.workouts 
ADD COLUMN equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL;

-- Habilitar RLS na tabela equipment
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para equipment (seguindo padrão existente)
CREATE POLICY "Users can view their own equipment" 
ON public.equipment 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own equipment" 
ON public.equipment 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own equipment" 
ON public.equipment 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own equipment" 
ON public.equipment 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at na tabela equipment
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar km acumulado automaticamente
CREATE OR REPLACE FUNCTION public.update_equipment_km()
RETURNS TRIGGER AS $$
DECLARE
    v_old_equipment_id UUID;
    v_new_equipment_id UUID;
    v_total_km NUMERIC;
    v_max_km NUMERIC;
BEGIN
    -- Determinar equipment_ids afetados
    IF TG_OP = 'DELETE' THEN
        v_old_equipment_id := OLD.equipment_id;
        v_new_equipment_id := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_equipment_id := NULL;
        v_new_equipment_id := NEW.equipment_id;
    ELSE -- UPDATE
        v_old_equipment_id := OLD.equipment_id;
        v_new_equipment_id := NEW.equipment_id;
    END IF;

    -- Atualizar equipment antigo (se mudou ou deletou)
    IF v_old_equipment_id IS NOT NULL AND (v_new_equipment_id IS NULL OR v_old_equipment_id != v_new_equipment_id) THEN
        SELECT COALESCE(SUM(distance_km), 0) INTO v_total_km
        FROM public.workouts 
        WHERE equipment_id = v_old_equipment_id;

        SELECT max_km INTO v_max_km FROM public.equipment WHERE id = v_old_equipment_id;

        UPDATE public.equipment 
        SET total_km = v_total_km,
            status = CASE 
                WHEN v_total_km >= v_max_km THEN 'retired'
                WHEN v_total_km >= v_max_km * 0.8 THEN 'attention'
                ELSE 'active'
            END,
            active_for_selection = (v_total_km < v_max_km)
        WHERE id = v_old_equipment_id;
    END IF;

    -- Atualizar equipment novo
    IF v_new_equipment_id IS NOT NULL THEN
        SELECT COALESCE(SUM(distance_km), 0) INTO v_total_km
        FROM public.workouts 
        WHERE equipment_id = v_new_equipment_id;

        SELECT max_km INTO v_max_km FROM public.equipment WHERE id = v_new_equipment_id;

        UPDATE public.equipment 
        SET total_km = v_total_km,
            status = CASE 
                WHEN v_total_km >= v_max_km THEN 'retired'
                WHEN v_total_km >= v_max_km * 0.8 THEN 'attention'
                ELSE 'active'
            END,
            active_for_selection = (v_total_km < v_max_km)
        WHERE id = v_new_equipment_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar km quando workout é salvo/atualizado/deletado
CREATE TRIGGER trigger_update_equipment_km
AFTER INSERT OR UPDATE OR DELETE ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.update_equipment_km();

-- Índice para melhorar performance de queries
CREATE INDEX idx_workouts_equipment_id ON public.workouts(equipment_id);
CREATE INDEX idx_equipment_user_id ON public.equipment(user_id);
CREATE INDEX idx_equipment_active ON public.equipment(user_id, active_for_selection) WHERE active_for_selection = true;