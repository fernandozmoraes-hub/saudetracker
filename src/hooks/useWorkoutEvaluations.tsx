import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface WorkoutEvaluation {
  id: string;
  user_id: string;
  workout_id: string;
  feeling_after: string | null;
  pain_discomfort: string | null;
  observations: string | null;
  max_hr: number | null;
  summary_technical: string | null;
  efficiency_quality: string | null;
  risks_redflags: string | null;
  general_suggestions: string | null;
  follow_up_qa: Array<{ question: string; answer: string }>;
  created_at: string;
  updated_at: string;
}

export interface EvaluationInput {
  workoutId: string;
  feelingAfter?: string;
  painDiscomfort?: string;
  observations?: string;
  maxHr?: number;
}

export interface WorkoutDataForEvaluation {
  type: string;
  date: string;
  duration_min: number;
  rpe: number;
  avg_hr?: number;
  max_hr?: number;
  distance_km?: number;
  tss_final?: number;
  time_z1_min?: number;
  time_z2_min?: number;
  time_z3_min?: number;
  time_z4_min?: number;
  time_z5_min?: number;
  session_type?: string;
  feeling_after?: string;
  pain_discomfort?: string;
  observations?: string;
}

export interface EvaluationResult {
  summaryTechnical: string;
  efficiencyQuality: string;
  risksRedflags: string;
  generalSuggestions: string;
}

export function useWorkoutEvaluations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [evaluations, setEvaluations] = useState<WorkoutEvaluation[]>([]);

  const fetchEvaluations = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('workout_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse follow_up_qa from JSON
      const parsed = (data || []).map(e => ({
        ...e,
        follow_up_qa: Array.isArray(e.follow_up_qa) ? e.follow_up_qa : []
      })) as WorkoutEvaluation[];
      
      setEvaluations(parsed);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    }
  }, [user]);

  const getEvaluationByWorkoutId = useCallback(async (workoutId: string): Promise<WorkoutEvaluation | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('workout_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        follow_up_qa: Array.isArray(data.follow_up_qa) ? data.follow_up_qa : []
      } as WorkoutEvaluation;
    } catch (error) {
      console.error('Error fetching evaluation:', error);
      return null;
    }
  }, [user]);

  const evaluateWorkout = useCallback(async (
    input: EvaluationInput,
    workoutData: WorkoutDataForEvaluation
  ): Promise<EvaluationResult | null> => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para avaliar treinos.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);

    try {
      // Merge additional data into workout data
      const fullWorkoutData: WorkoutDataForEvaluation = {
        ...workoutData,
        feeling_after: input.feelingAfter,
        pain_discomfort: input.painDiscomfort,
        observations: input.observations,
        max_hr: input.maxHr || workoutData.max_hr
      };

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workout-evaluator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            type: 'evaluate',
            workout: fullWorkoutData
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to evaluate workout');
      }

      const result = await response.json();

      // Save evaluation to database
      const { error: insertError } = await supabase
        .from('workout_evaluations')
        .upsert({
          user_id: user.id,
          workout_id: input.workoutId,
          feeling_after: input.feelingAfter || null,
          pain_discomfort: input.painDiscomfort || null,
          observations: input.observations || null,
          max_hr: input.maxHr || null,
          summary_technical: result.summaryTechnical,
          efficiency_quality: result.efficiencyQuality,
          risks_redflags: result.risksRedflags,
          general_suggestions: result.generalSuggestions,
          follow_up_qa: []
        }, {
          onConflict: 'workout_id'
        });

      if (insertError) {
        console.error('Error saving evaluation:', insertError);
        // Don't throw, still return the result
      }

      await fetchEvaluations();

      return {
        summaryTechnical: result.summaryTechnical,
        efficiencyQuality: result.efficiencyQuality,
        risksRedflags: result.risksRedflags,
        generalSuggestions: result.generalSuggestions
      };

    } catch (error) {
      console.error('Error evaluating workout:', error);
      toast({
        title: "Erro na avaliação",
        description: error instanceof Error ? error.message : "Não foi possível avaliar o treino.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, fetchEvaluations]);

  const askFollowUp = useCallback(async (
    evaluationId: string,
    question: string,
    previousAnalysis: EvaluationResult
  ): Promise<string | null> => {
    if (!user) return null;

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workout-evaluator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            type: 'followup',
            question,
            previousAnalysis
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const result = await response.json();
      const answer = result.answer;

      // Update the evaluation with the new Q&A
      const { data: evaluation, error: fetchError } = await supabase
        .from('workout_evaluations')
        .select('follow_up_qa')
        .eq('id', evaluationId)
        .single();

      if (!fetchError && evaluation) {
        const currentQA = Array.isArray(evaluation.follow_up_qa) ? evaluation.follow_up_qa : [];
        const updatedQA = [...currentQA, { question, answer }];

        await supabase
          .from('workout_evaluations')
          .update({ follow_up_qa: updatedQA })
          .eq('id', evaluationId);

        await fetchEvaluations();
      }

      return answer;

    } catch (error) {
      console.error('Error asking follow-up:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível obter resposta.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, fetchEvaluations]);

  return {
    evaluations,
    isLoading,
    fetchEvaluations,
    getEvaluationByWorkoutId,
    evaluateWorkout,
    askFollowUp
  };
}
