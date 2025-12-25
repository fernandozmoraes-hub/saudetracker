-- Create table for Strava OAuth connections
CREATE TABLE public.strava_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  strava_athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  athlete_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own strava connection"
ON public.strava_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava connection"
ON public.strava_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava connection"
ON public.strava_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava connection"
ON public.strava_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_strava_connections_updated_at
BEFORE UPDATE ON public.strava_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add strava_activity_id to workouts table to track imported activities
ALTER TABLE public.workouts ADD COLUMN strava_activity_id BIGINT;