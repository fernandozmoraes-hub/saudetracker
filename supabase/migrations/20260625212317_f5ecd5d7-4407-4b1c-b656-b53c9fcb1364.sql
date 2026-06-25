ALTER TABLE public.performance_coach_history
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS report_period_start DATE,
  ADD COLUMN IF NOT EXISTS report_period_end DATE;

ALTER TABLE public.performance_coach_history
  DROP CONSTRAINT IF EXISTS performance_coach_history_entry_type_check;

ALTER TABLE public.performance_coach_history
  ADD CONSTRAINT performance_coach_history_entry_type_check
  CHECK (entry_type IN ('chat', 'weekly_report'));

CREATE INDEX IF NOT EXISTS idx_pch_entry_type
  ON public.performance_coach_history (user_id, entry_type, created_at DESC);