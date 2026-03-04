
-- Create alcohol_intake table
CREATE TABLE public.alcohol_intake (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  time time NULL,
  drink_type text NOT NULL,
  volume_ml numeric NOT NULL,
  num_drinks integer NOT NULL DEFAULT 1,
  abv_percent numeric NOT NULL,
  alcohol_grams numeric NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alcohol_intake ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own alcohol intake" ON public.alcohol_intake FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own alcohol intake" ON public.alcohol_intake FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own alcohol intake" ON public.alcohol_intake FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own alcohol intake" ON public.alcohol_intake FOR DELETE USING (auth.uid() = user_id);

-- Add alcohol_yesterday column to daily_checks
ALTER TABLE public.daily_checks ADD COLUMN alcohol_yesterday boolean DEFAULT false;
