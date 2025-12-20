-- Alterar coluna duration_min de INTEGER para NUMERIC(10,2)
ALTER TABLE workouts 
  ALTER COLUMN duration_min TYPE NUMERIC(10,2);