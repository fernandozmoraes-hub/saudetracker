-- Adicionar campos de zonas de FC na tabela user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS resting_hr integer;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS max_hr integer;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zone1_upper_pct integer DEFAULT 84;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zone2_upper_pct integer DEFAULT 89;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zone3_upper_pct integer DEFAULT 94;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zone4_upper_pct integer DEFAULT 99;

-- Adicionar campos de tempo por zona e método TSS na tabela workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS time_z1_min numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS time_z2_min numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS time_z3_min numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS time_z4_min numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS time_z5_min numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS tss_method text DEFAULT 'HR_avg';

-- Comentários para documentação
COMMENT ON COLUMN user_settings.zone1_upper_pct IS 'Limite superior da Z1 em % do LTHR (padrão: 84%)';
COMMENT ON COLUMN user_settings.zone2_upper_pct IS 'Limite superior da Z2 em % do LTHR (padrão: 89%)';
COMMENT ON COLUMN user_settings.zone3_upper_pct IS 'Limite superior da Z3 em % do LTHR (padrão: 94%)';
COMMENT ON COLUMN user_settings.zone4_upper_pct IS 'Limite superior da Z4 em % do LTHR (padrão: 99%)';
COMMENT ON COLUMN workouts.tss_method IS 'Método de cálculo: HR_avg (legado), HR_zones (novo), RPE (força)';