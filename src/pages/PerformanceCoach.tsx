import { useMemo, useState, useRef, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/hooks/useData';
import { useAlcoholIntake } from '@/hooks/useAlcoholIntake';
import { useBodyComposition } from '@/hooks/useBodyComposition';
import { useEquipment } from '@/hooks/useEquipment';
import { supabase } from '@/integrations/supabase/client';
import { buildPerformanceContext, getCoverageWarnings } from '@/lib/performanceContext';
import { useToast } from '@/hooks/use-toast';
import { Brain, Loader2, Send, AlertTriangle, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'Qual o meu estado fisiológico hoje?',
  'Como minha carga de treino dos últimos 30 dias se relaciona com meu HRV?',
  'O álcool tem afetado minha recuperação?',
  'Minha massa muscular está sendo preservada?',
  'Algum dos meus tênis está perto do limite de uso?',
  'Há sinais de fadiga acumulada?',
];

function renderMarkdown(text: string): JSX.Element[] {
  return text.split('\n').map((line, i) => {
    const parts: (string | JSX.Element)[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      parts.push(<strong key={`b-${i}-${key++}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <p key={i} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
        {parts}
      </p>
    );
  });
}

export default function PerformanceCoach() {
  const { dailyChecks, workouts } = useData();
  const { entries: alcoholEntries } = useAlcoholIntake();
  const { entries: bodyComposition } = useBodyComposition();
  const { equipment } = useEquipment();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const performanceContext = useMemo(
    () =>
      buildPerformanceContext({
        dailyChecks,
        workouts,
        alcoholEntries,
        bodyComposition,
        equipment,
      }),
    [dailyChecks, workouts, alcoholEntries, bodyComposition, equipment]
  );

  const warnings = useMemo(() => getCoverageWarnings(performanceContext), [performanceContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = async (questionText?: string) => {
    const question = (questionText ?? input).trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('performance-coach', {
        body: {
          performanceContext,
          messages: nextMessages.slice(-10),
          question,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const answer: string = data?.answer ?? 'Sem resposta.';
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err: any) {
      console.error('performance-coach error:', err);
      toast({
        title: 'Não foi possível obter resposta',
        description: err?.message ?? 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠ Não foi possível gerar a resposta agora. Tente novamente em instantes.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <PageContainer
      title="Performance Coach"
      subtitle="Análise integrada do seu estado atual e tendências"
    >
      {/* Header card */}
      <div className="gradient-card rounded-xl p-5 border border-border/50 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold">Como funciona</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Pergunte sobre seus dados fisiológicos, carga de treino, composição corporal,
          álcool ou equipamentos. O agente interpreta — não prescreve treinos.
        </p>
      </div>

      {/* Coverage warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl p-4 border border-status-alert/30 bg-status-alert/10 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-status-alert" />
            <span className="text-sm font-medium text-status-alert">Cobertura limitada</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="space-y-2 animate-slide-up">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <span>Sugestões</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full border border-border/50 bg-secondary/50 hover:bg-secondary transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'rounded-xl px-4 py-3 bg-primary text-primary-foreground ml-8'
                : 'rounded-xl px-4 py-3 bg-secondary/40 border border-border/40 mr-4'
            }
          >
            <div className="text-xs font-medium mb-1 opacity-70">
              {m.role === 'user' ? 'Você' : 'Performance Coach'}
            </div>
            <div className="text-sm space-y-1">{renderMarkdown(m.content)}</div>
          </div>
        ))}
        {isLoading && (
          <div className="rounded-xl px-4 py-3 bg-secondary/40 border border-border/40 mr-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analisando seus dados...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-20 bg-background/80 backdrop-blur-sm pt-2">
        <div className="rounded-xl border border-border/50 bg-card p-2 flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seu estado fisiológico, carga, álcool, composição corporal..."
            className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
