-- Sinaliza quando o refresh_token do WHOOP não pode mais ser renovado (ex.: revogado,
-- ou perdeu a corrida contra outra invocação concorrente do webhook), para o Settings
-- parar de mostrar "conectado" quando na verdade o check-in automático parou de funcionar.
ALTER TABLE public.whoop_connections
ADD COLUMN needs_reauth BOOLEAN NOT NULL DEFAULT false;
