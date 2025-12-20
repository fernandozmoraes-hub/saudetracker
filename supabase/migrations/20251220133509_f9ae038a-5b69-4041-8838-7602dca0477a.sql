-- FASE 1: Migração do Banco de Dados para Modelo Híbrido TSS

-- 1.1 Adicionar novas colunas à tabela workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'legacy';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS tss_version TEXT DEFAULT 'v1_rpe';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS tss_final NUMERIC(10,2);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS lthr_used INTEGER;

-- Constraints para validação
ALTER TABLE workouts ADD CONSTRAINT check_session_type 
  CHECK (session_type IN ('endurance', 'strength', 'legacy'));
ALTER TABLE workouts ADD CONSTRAINT check_tss_version 
  CHECK (tss_version IN ('v1_rpe', 'v2_hybrid'));

-- Migrar dados existentes: tss_final = tss_subjective para histórico
UPDATE workouts SET tss_final = tss_subjective WHERE tss_final IS NULL;

-- 1.2 Criar tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  lthr INTEGER DEFAULT 165,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();