
-- Tipo de role
CREATE TYPE public.app_role AS ENUM ('coach', 'athlete');

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: usuário vê suas próprias roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS: authenticated pode inserir sua própria role
CREATE POLICY "Users can insert their own role" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Função security definer para checar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tabela coach_athletes
CREATE TABLE public.coach_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);
ALTER TABLE public.coach_athletes ENABLE ROW LEVEL SECURITY;

-- Função para checar relação coach-atleta
CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id uuid, _athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_athletes
    WHERE coach_id = _coach_id AND athlete_id = _athlete_id AND status = 'active'
  )
$$;

-- RLS coach_athletes
CREATE POLICY "Coaches can view their athlete relationships" ON public.coach_athletes
  FOR SELECT TO authenticated USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

CREATE POLICY "Coaches can insert athlete relationships" ON public.coach_athletes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can update their athlete relationships" ON public.coach_athletes
  FOR UPDATE TO authenticated USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can delete their athlete relationships" ON public.coach_athletes
  FOR DELETE TO authenticated USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

-- Tabela training_plans
CREATE TABLE public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  date date NOT NULL,
  type text NOT NULL,
  planned_duration_min numeric,
  planned_zone text,
  planned_tss numeric,
  notes text,
  status text NOT NULL DEFAULT 'planned',
  workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- RLS training_plans
CREATE POLICY "Coaches can manage their training plans" ON public.training_plans
  FOR ALL TO authenticated USING (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'))
  WITH CHECK (auth.uid() = coach_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Athletes can view their training plans" ON public.training_plans
  FOR SELECT TO authenticated USING (auth.uid() = athlete_id);

-- Coach SELECT policies on existing tables
CREATE POLICY "Coaches can view athlete daily checks" ON public.daily_checks
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Coaches can view athlete workouts" ON public.workouts
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Coaches can view athlete body composition" ON public.body_composition
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Coaches can view athlete alcohol intake" ON public.alcohol_intake
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Coaches can view athlete equipment" ON public.equipment
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Coaches can view athlete workout evaluations" ON public.workout_evaluations
  FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));

-- EMENDA 1: Migrar usuários existentes como athlete
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'athlete'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Indexes
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_coach_athletes_coach_id ON public.coach_athletes(coach_id);
CREATE INDEX idx_coach_athletes_athlete_id ON public.coach_athletes(athlete_id);
CREATE INDEX idx_training_plans_athlete_date ON public.training_plans(athlete_id, date);
CREATE INDEX idx_training_plans_coach_id ON public.training_plans(coach_id);
