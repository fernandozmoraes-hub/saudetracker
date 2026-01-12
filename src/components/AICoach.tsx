import { useState, useEffect } from 'react';
import { Brain, RefreshCw, AlertCircle } from 'lucide-react';
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

export function AICoach() {
  const { dailyChecks, workouts } = useData();
  const [state, setState] = useState<AICoachState>({
    analysis: null,
    classification: 'blocked',
    isLoading: false,
    lastUpdated: null,
    error: null,
  });

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
    // Auto-fetch when data changes and we have today's check
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

  return (
    <div className="gradient-card rounded-xl p-5 border border-border/50 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-display font-semibold text-lg">Avaliação do Coach</span>
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
          <p className="text-sm text-foreground/90 leading-relaxed">
            {state.analysis}
          </p>
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
  );
}
