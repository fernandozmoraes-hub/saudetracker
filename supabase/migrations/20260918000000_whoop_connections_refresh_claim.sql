-- Trava otimista pra evitar duas invocações do whoop-webhook (disparadas quase juntas por
-- recovery.updated + sleep.updated) tentando renovar o mesmo refresh_token ao mesmo tempo.
-- A WHOOP invalida o refresh_token inteiro quando recebe duas tentativas concorrentes, então
-- checar depois de falhar (como fazíamos antes) não ajuda — precisa impedir a segunda
-- tentativa de sequer chamar a WHOOP.
ALTER TABLE public.whoop_connections
ADD COLUMN refresh_claimed_at TIMESTAMPTZ;
