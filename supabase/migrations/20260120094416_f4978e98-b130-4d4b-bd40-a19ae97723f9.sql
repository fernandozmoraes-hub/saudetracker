-- Remove duplicate workout evaluations, keeping the most recent one
DELETE FROM workout_evaluations a
USING workout_evaluations b
WHERE a.workout_id = b.workout_id 
  AND a.created_at < b.created_at;

-- Create unique index on workout_id to allow upsert with onConflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_evaluations_workout_unique 
ON workout_evaluations(workout_id);