CREATE TABLE public.whoop_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whoop_user_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whoop_connections TO authenticated;
GRANT ALL ON public.whoop_connections TO service_role;

ALTER TABLE public.whoop_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own whoop connection"
ON public.whoop_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whoop connection"
ON public.whoop_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whoop connection"
ON public.whoop_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whoop connection"
ON public.whoop_connections FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_whoop_connections_updated_at
BEFORE UPDATE ON public.whoop_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();