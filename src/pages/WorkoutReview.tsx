import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/hooks/useData';
import { useWorkoutEvaluations, EvaluationResult, WorkoutDataForEvaluation } from '@/hooks/useWorkoutEvaluations';
import { Workout } from '@/types/health';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Activity, 
  Clock, 
  Heart, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

export default function WorkoutReview() {
  const { workouts } = useData();
  const { 
    evaluations, 
    isLoading, 
    fetchEvaluations, 
    getEvaluationByWorkoutId,
    evaluateWorkout, 
    askFollowUp 
  } = useWorkoutEvaluations();

  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [feelingAfter, setFeelingAfter] = useState('');
  const [painDiscomfort, setPainDiscomfort] = useState('');
  const [observations, setObservations] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpHistory, setFollowUpHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  const handleSelectWorkout = async (workout: Workout) => {
    setSelectedWorkout(workout);
    setCurrentEvaluation(null);
    setCurrentEvaluationId(null);
    setFollowUpHistory([]);
    setFeelingAfter('');
    setPainDiscomfort('');
    setObservations('');
    setMaxHr('');

    // Check if there's an existing evaluation
    const existing = await getEvaluationByWorkoutId(workout.id);
    if (existing) {
      setCurrentEvaluation({
        summaryTechnical: existing.summary_technical || '',
        efficiencyQuality: existing.efficiency_quality || '',
        risksRedflags: existing.risks_redflags || '',
        generalSuggestions: existing.general_suggestions || ''
      });
      setCurrentEvaluationId(existing.id);
      setFollowUpHistory(existing.follow_up_qa || []);
      setFeelingAfter(existing.feeling_after || '');
      setPainDiscomfort(existing.pain_discomfort || '');
      setObservations(existing.observations || '');
      setMaxHr(existing.max_hr?.toString() || '');
    }
  };

  const handleEvaluate = async () => {
    if (!selectedWorkout) return;

    setIsEvaluating(true);

    const workoutData: WorkoutDataForEvaluation = {
      type: selectedWorkout.type,
      date: selectedWorkout.date,
      duration_min: selectedWorkout.durationMin,
      rpe: selectedWorkout.rpe,
      avg_hr: selectedWorkout.avgHr || undefined,
      distance_km: selectedWorkout.distanceKm || undefined,
      tss_final: selectedWorkout.tssFinal || undefined,
      time_z1_min: selectedWorkout.timeZ1Min || undefined,
      time_z2_min: selectedWorkout.timeZ2Min || undefined,
      time_z3_min: selectedWorkout.timeZ3Min || undefined,
      time_z4_min: selectedWorkout.timeZ4Min || undefined,
      time_z5_min: selectedWorkout.timeZ5Min || undefined,
      session_type: selectedWorkout.sessionType || undefined
    };

    const response = await evaluateWorkout(
      {
        workoutId: selectedWorkout.id,
        feelingAfter: feelingAfter || undefined,
        painDiscomfort: painDiscomfort || undefined,
        observations: observations || undefined,
        maxHr: maxHr ? parseInt(maxHr) : undefined
      },
      workoutData
    );

    if (response) {
      setCurrentEvaluation(response.result);
      setCurrentEvaluationId(response.evaluationId);
    }

    setIsEvaluating(false);
  };

  const handleAskFollowUp = async () => {
    if (!followUpQuestion.trim()) return;
    
    if (!currentEvaluation || !currentEvaluationId) {
      // Show feedback when evaluation is missing
      console.error('No evaluation found. Please evaluate the workout first.');
      return;
    }

    setIsAskingFollowUp(true);
    const question = followUpQuestion;
    setFollowUpQuestion('');

    const answer = await askFollowUp(currentEvaluationId, question, currentEvaluation);
    
    if (answer) {
      setFollowUpHistory(prev => [...prev, { question, answer }]);
    }

    setIsAskingFollowUp(false);
  };

  const sortedWorkouts = [...workouts].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatWorkoutType = (type: string) => {
    const types: Record<string, string> = {
      'run': 'Corrida',
      'cycling': 'Ciclismo',
      'swimming': 'Natação',
      'strength': 'Força',
      'other': 'Outro'
    };
    return types[type] || type;
  };

  return (
    <PageContainer title="Avaliação de Treinos">
      <div className="space-y-6 pb-24">
        {/* Workout Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Selecionar Treino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {sortedWorkouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum treino registrado
                  </p>
                ) : (
                  sortedWorkouts.map((workout) => {
                    const hasEvaluation = evaluations.some(e => e.workout_id === workout.id);
                    return (
                      <button
                        key={workout.id}
                        onClick={() => handleSelectWorkout(workout)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedWorkout?.id === workout.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">
                                {formatWorkoutType(workout.type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(workout.date), "dd 'de' MMM", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {workout.durationMin}min
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              RPE {workout.rpe}
                            </Badge>
                            {hasEvaluation && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Complementary Data Form */}
        {selectedWorkout && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados Complementares</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="feeling">Sensação após o treino</Label>
                <Textarea
                  id="feeling"
                  placeholder="Como você se sentiu após o treino?"
                  value={feelingAfter}
                  onChange={(e) => setFeelingAfter(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="pain">Dores ou desconfortos</Label>
                <Textarea
                  id="pain"
                  placeholder="Alguma dor ou desconforto durante/após?"
                  value={painDiscomfort}
                  onChange={(e) => setPainDiscomfort(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="observations">Observações adicionais</Label>
                <Textarea
                  id="observations"
                  placeholder="Outras observações relevantes..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="maxHr">FC Máxima (opcional)</Label>
                <Input
                  id="maxHr"
                  type="number"
                  placeholder="bpm"
                  value={maxHr}
                  onChange={(e) => setMaxHr(e.target.value)}
                  className="mt-1 w-32"
                />
              </div>

              <Button 
                onClick={handleEvaluate} 
                disabled={isEvaluating}
                className="w-full"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Avaliando...
                  </>
                ) : currentEvaluation ? (
                  'Reavaliar Treino'
                ) : (
                  'Avaliar Treino'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Evaluation Results */}
        {currentEvaluation && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Análise do Agente</h2>

            {/* Block A - Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  (A) Resumo Técnico do Treino
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {currentEvaluation.summaryTechnical}
                </p>
              </CardContent>
            </Card>

            {/* Block B - Efficiency */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
                  <CheckCircle className="h-4 w-4" />
                  (B) Eficiência e Qualidade da Sessão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {currentEvaluation.efficiencyQuality}
                </p>
              </CardContent>
            </Card>

            {/* Block C - Risks */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  (C) Riscos e Red Flags Identificados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {currentEvaluation.risksRedflags}
                </p>
              </CardContent>
            </Card>

            {/* Block D - Suggestions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                  <Lightbulb className="h-4 w-4" />
                  (D) Sugestões Gerais Não Prescritivas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {currentEvaluation.generalSuggestions}
                </p>
              </CardContent>
            </Card>

            {/* Follow-up Questions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Perguntas ao Agente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {followUpHistory.length > 0 && (
                  <div className="space-y-3">
                    {followUpHistory.map((qa, index) => (
                      <div key={index} className="space-y-2">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Você perguntou:</p>
                          <p className="text-sm">{qa.question}</p>
                        </div>
                        <div className="bg-primary/5 p-3 rounded-lg ml-4">
                          <p className="text-xs text-muted-foreground mb-1">Resposta:</p>
                          <p className="text-sm whitespace-pre-wrap">{qa.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Faça uma pergunta sobre este treino..."
                    value={followUpQuestion}
                    onChange={(e) => setFollowUpQuestion(e.target.value)}
                    className="flex-1"
                    rows={2}
                  />
                  <Button 
                    size="icon"
                    onClick={handleAskFollowUp}
                    disabled={!followUpQuestion.trim() || isAskingFollowUp}
                  >
                    {isAskingFollowUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Evaluation History */}
        {evaluations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="text-base">
                  Histórico de Avaliações ({evaluations.length})
                </CardTitle>
                {showHistory ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CardHeader>
            {showHistory && (
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {evaluations.map((evaluation) => {
                      const workout = workouts.find(w => w.id === evaluation.workout_id);
                      if (!workout) return null;
                      
                      return (
                        <button
                          key={evaluation.id}
                          onClick={() => handleSelectWorkout(workout)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {formatWorkoutType(workout.type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(workout.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {workout.durationMin}min
                              </Badge>
                              {evaluation.follow_up_qa.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {evaluation.follow_up_qa.length} perguntas
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
