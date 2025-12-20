-- Add muscle_groups column to workouts table
ALTER TABLE public.workouts ADD COLUMN muscle_groups text[] DEFAULT NULL;