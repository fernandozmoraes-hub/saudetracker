-- Create daily_checks table
CREATE TABLE public.daily_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    hrv INTEGER NOT NULL,
    resting_hr INTEGER NOT NULL,
    sleep_hours NUMERIC(3,1) NOT NULL,
    sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, date)
);

-- Create workouts table
CREATE TABLE public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Run', 'Strength', 'Bike', 'Rest')),
    duration_min INTEGER NOT NULL DEFAULT 0,
    rpe INTEGER NOT NULL DEFAULT 0 CHECK (rpe BETWEEN 0 AND 10),
    tss_subjective INTEGER NOT NULL DEFAULT 0,
    validated BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.daily_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_checks
CREATE POLICY "Users can view their own daily checks"
ON public.daily_checks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily checks"
ON public.daily_checks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily checks"
ON public.daily_checks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily checks"
ON public.daily_checks
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for workouts
CREATE POLICY "Users can view their own workouts"
ON public.workouts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts"
ON public.workouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
ON public.workouts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
ON public.workouts
FOR DELETE
USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily_checks
CREATE TRIGGER update_daily_checks_updated_at
BEFORE UPDATE ON public.daily_checks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_daily_checks_user_date ON public.daily_checks(user_id, date);
CREATE INDEX idx_workouts_user_date ON public.workouts(user_id, date);