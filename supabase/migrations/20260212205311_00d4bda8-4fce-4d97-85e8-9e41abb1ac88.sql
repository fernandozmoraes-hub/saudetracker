
-- Create body_composition table
CREATE TABLE public.body_composition (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  weight_kg numeric NOT NULL,
  muscle_mass_kg numeric NOT NULL,
  body_fat_pct numeric NOT NULL,
  data_source text NOT NULL DEFAULT 'manual',
  notes text,
  flagged_inconsistent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT body_composition_user_date_unique UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.body_composition ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own body composition"
ON public.body_composition FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own body composition"
ON public.body_composition FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own body composition"
ON public.body_composition FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own body composition"
ON public.body_composition FOR DELETE
USING (auth.uid() = user_id);

-- Reuse updated_at trigger
CREATE TRIGGER update_body_composition_updated_at
BEFORE UPDATE ON public.body_composition
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
