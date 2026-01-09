import { useState, useEffect } from 'react';
import { Brain, RefreshCw, AlertCircle, Calendar, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildAnalysisData } from '@/lib/analysisData';
import { getClassificationEmoji, getClassificationLabel, TriggerResult } from '@/lib/triggers';
import { useData } from '@/hooks/useData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AICoachState {
  analysis: string | null;
  classification: TriggerResult['classification'];
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

function parseCoachResponse(response: string): { dayAssessment: string; weeklyPlan: string } {
  // Try to split by common patterns
  const planPatterns = [
    /PLANO SEMANAL/i,
    /PLANEJAMENTO SEMANAL/i,
    /## BLOCO 2/i,
    /\*\*PLANO SEMANAL\*\*/i,
    /Segunda:/i,
  ];
  
  let splitIndex = -1;
  for (const pattern of planPatterns) {
    const match = response.search(pattern);
    if (match !== -1) {
      splitIndex = match;
      break;
    }
  }
  
  if (splitIndex > 0) {
    return {
      dayAssessment: response.slice(0, splitIndex).trim(),
      weeklyPlan: response.slice(splitIndex).trim(),
    };
  }
  
  // If can't split, return everything as day assessment
  return {
    dayAssessment: response,
    weeklyPlan: '',
  };
}

function formatMarkdownText(text: string): string {
  // Clean up markdown formatting for display
  return text
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/##\s*/g, '') // Remove heading markers
    .replace(/BLOCO \d:/i, '') // Remove block labels
    .replace(/AVALIAÇÃO DO DIA/i, '')
    .trim();
}

export function AICoach() {
  const { dailyChecks, workouts } = useData();
  const [state, setState] = useState<AICoachState>({
    analysis: null,
    classification: 'blocked',
    isLoading: false,
    lastUpdated: null,
    error: null,
  });
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);

  const fetchAnalysis = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const { data: analysisData, triggerResult } = buildAnalysisData(dailyChecks, workouts);
    
    if (!triggerResult.canProceed || !analysisData) {
      setState({
        analysis: 'Dados insuficientes para avaliação segura.',
        classification: 'blocked',
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: { analysisData, triggerResult },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setState({
        analysis: data.analysis,
        classification: data.classification || triggerResult.classification,
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
      });
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter análise';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    const { triggerResult } = buildAnalysisData(dailyChecks, workouts);
    if (triggerResult.canProceed) {
      fetchAnalysis();
    } else {
      setState(prev => ({
        ...prev,
        classification: 'blocked',
        analysis: 'Dados insuficientes para avaliação segura.',
      }));
    }
  }, [dailyChecks, workouts]);

  const getClassificationStyles = (classification: TriggerResult['classification']) => {
    switch (classification) {
      case 'safe':
        return 'bg-status-ok/10 border-status-ok/30 text-status-ok';
      case 'attention':
        return 'bg-status-alert/10 border-status-alert/30 text-status-alert';
      case 'risk':
        return 'bg-status-critical/10 border-status-critical/30 text-status-critical';
      default:
        return 'bg-muted/50 border-border text-muted-foreground';
    }
  };

  const { dayAssessment, weeklyPlan } = state.analysis 
    ? parseCoachResponse(state.analysis) 
    : { dayAssessment: '', weeklyPlan: '' };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Day Assessment Card */}
      <div className="gradient-card rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-display font-semibold text-lg">Avaliação do Dia</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchAnalysis}
            disabled={state.isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={`w-4 h-4 ${state.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Classification Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${getClassificationStyles(state.classification)}`}>
          <span>{getClassificationEmoji(state.classification)}</span>
          <span>{getClassificationLabel(state.classification)}</span>
        </div>

        {/* Analysis Content */}
        <div className="space-y-3">
          {state.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analisando seus dados...</span>
            </div>
          ) : state.error ? (
            <div className="flex items-start gap-2 text-status-critical">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{state.error}</span>
            </div>
          ) : (
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {formatMarkdownText(dayAssessment)}
            </div>
          )}
        </div>

        {/* Last Updated */}
        {state.lastUpdated && !state.isLoading && (
          <p className="text-xs text-muted-foreground mt-4">
            Última análise: {state.lastUpdated.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </div>

      {/* Weekly Plan Card */}
      {weeklyPlan && !state.isLoading && !state.error && (
        <div className="gradient-card rounded-xl p-5 border border-border/50">
          <button
            onClick={() => setShowWeeklyPlan(!showWeeklyPlan)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-primary" />
              <span className="font-display font-semibold text-lg">Planejamento Semanal</span>
            </div>
            <span className="text-muted-foreground text-sm">
              {showWeeklyPlan ? 'Ocultar' : 'Ver plano'}
            </span>
          </button>

          {showWeeklyPlan && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                {formatMarkdownText(weeklyPlan)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
