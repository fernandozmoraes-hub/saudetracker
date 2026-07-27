-- whoop_connections já foi criada em 20260707120000_whoop_connections.sql (mesma tabela, RLS e policies).
-- Este arquivo original recriava a tabela do zero, o que falha com "relation already exists"
-- e impede que o restante do arquivo (grants e trigger) seja aplicado. Mantém só o que faltava.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whoop_connections TO authenticated;
GRANT ALL ON public.whoop_connections TO service_role;

CREATE TRIGGER update_whoop_connections_updated_at
BEFORE UPDATE ON public.whoop_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
