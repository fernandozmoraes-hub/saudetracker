import { useMemo, useState, useRef, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useData } from '@/hooks/useData';
import { useAlcoholIntake } from '@/hooks/useAlcoholIntake';
import { useBodyComposition } from '@/hooks/useBodyComposition';
import { useEquipment } from '@/hooks/useEquipment';
import { supabase } from '@/integrations/supabase/client';
import { buildPerformanceContext, getCoverageWarnings } from '@/lib/performanceContext';
import {
  routePerformanceQuestion,
  filterPerformanceContext,
  INTENT_LABELS,
  INTENT_TAGS,
  SECTION_LABELS,
  CoachIntent,
  SectionKey,
} from '@/lib/contextRouter';
import {
  usePerformanceCoachHistory,
  CoachHistoryEntry,
} from '@/hooks/usePerformanceCoachHistory';
import { useToast } from '@/hooks/use-toast';
import {
  Brain,
  Loader2,
  Send,
  AlertTriangle,
  Sparkles,
  Star,
  Trash2,
  Search,
  BookOpen,
  MessageSquare,
  BarChart3,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildWeeklyPerformanceContext } from '@/lib/weeklyPerformanceContext';
import { generateWeeklyReportPdf } from '@/lib/weeklyReportPdf';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sectionsUsed?: SectionKey[];
  intent?: CoachIntent;
  isWeeklyReport?: boolean;
  periodStart?: string;
  periodEnd?: string;
}


const SUGGESTED_QUESTIONS = [
  'Qual o meu estado fisiológico hoje?',
  'Como minha carga de treino dos últimos 30 dias se relaciona com meu HRV?',
  'O álcool tem afetado minha recuperação?',
  'Minha massa muscular está sendo preservada?',
  'Algum dos meus tênis está perto do limite de uso?',
  'Há sinais de fadiga acumulada?',
];

const FILTER_INTENTS: Array<{ key: CoachIntent | 'favorites'; label: string }> = [
  { key: 'recovery', label: 'Recuperação' },
  { key: 'training_load', label: 'Carga' },
  { key: 'body_composition', label: 'Composição' },
  { key: 'alcohol_impact', label: 'Álcool' },
  { key: 'equipment', label: 'Equipamentos' },
  { key: 'progress', label: 'Evolução' },
  { key: 'general', label: 'Geral' },
  { key: 'favorites', label: '★ Favoritos' },
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
  const history = usePerformanceCoachHistory();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Library state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CoachIntent | 'favorites' | 'all'>('all');
  const [openEntry, setOpenEntry] = useState<CoachHistoryEntry | null>(null);

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

    const route = routePerformanceQuestion(question);
    const { filtered, sectionsIncluded } = filterPerformanceContext(
      performanceContext as any,
      route.requiredSections,
      route.optionalSections
    );

    const userMessage: ChatMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('performance-coach', {
        body: {
          performanceContext: filtered,
          messages: nextMessages.slice(-10),
          question,
          intent: route.intent,
          sectionsUsed: sectionsIncluded,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const answer: string = data?.answer ?? 'Sem resposta.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: answer,
          sectionsUsed: sectionsIncluded,
          intent: route.intent,
        },
      ]);

      // Persist only on success
      await history.save({
        question,
        answer,
        intent: route.intent,
        sections: sectionsIncluded,
        tags: [INTENT_TAGS[route.intent]],
      });
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
      // intentionally NOT saving errors/timeouts to library
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

  const filteredHistory = useMemo(() => {
    let list = history.entries;
    if (filter === 'favorites') list = list.filter(e => e.favorite);
    else if (filter !== 'all') list = list.filter(e => e.intent_detected === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.question.toLowerCase().includes(q) ||
          e.answer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [history.entries, filter, search]);

  return (
    <PageContainer
      title="Performance Coach"
      subtitle="Análise integrada do seu estado atual e tendências"
    >
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <BookOpen className="w-4 h-4" /> Biblioteca
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────── CHAT ───────────────────── */}
        <TabsContent value="chat" className="space-y-4 mt-4">
          {/* Header card */}
          <div className="gradient-card rounded-xl p-5 border border-border/50 animate-slide-up">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold">Como funciona</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pergunte sobre seus dados fisiológicos, carga, composição corporal,
              álcool ou equipamentos. O agente seleciona apenas as seções relevantes
              e interpreta — não prescreve treinos.
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
                {m.role === 'assistant' && m.sectionsUsed && m.sectionsUsed.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                    <span className="opacity-70">Dados utilizados:</span>{' '}
                    {m.sectionsUsed.map(s => (
                      <span key={s} className="inline-flex items-center mr-2">
                        ✓ {SECTION_LABELS[s]}
                      </span>
                    ))}
                  </div>
                )}
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
                placeholder="Pergunte sobre seu estado fisiológico, carga, álcool, composição..."
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
        </TabsContent>

        {/* ───────────────────── LIBRARY ───────────────────── */}
        <TabsContent value="library" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar em perguntas e respostas..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/50 bg-secondary/50 hover:bg-secondary'
              }`}
            >
              Todos
            </button>
            {FILTER_INTENTS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border/50 bg-secondary/50 hover:bg-secondary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {history.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma análise salva ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(e => {
                const intentLabel =
                  INTENT_LABELS[e.intent_detected as CoachIntent] ?? e.intent_detected;
                const firstLine = e.answer
                  .split('\n')
                  .map(l => l.replace(/\*\*/g, '').trim())
                  .find(l => l.length > 0) ?? '';
                return (
                  <div
                    key={e.id}
                    className="rounded-xl p-3 border border-border/50 bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <button
                      onClick={() => setOpenEntry(e)}
                      className="w-full text-left space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1">{e.question}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {format(new Date(e.created_at), "d MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{firstLine}</p>
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-secondary/70 border border-border/40">
                        {intentLabel}
                      </span>
                    </button>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => history.toggleFavorite(e.id)}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            e.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (confirm('Excluir esta análise?')) history.remove(e.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Entry detail dialog */}
      <Dialog open={!!openEntry} onOpenChange={o => !o && setOpenEntry(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {openEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base pr-6">{openEntry.question}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(openEntry.created_at), "d 'de' MMMM, HH:mm", { locale: ptBR })}
                  </span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary/70 border border-border/40">
                    {INTENT_LABELS[openEntry.intent_detected as CoachIntent] ??
                      openEntry.intent_detected}
                  </span>
                </div>
                <div className="space-y-1">{renderMarkdown(openEntry.answer)}</div>
                {openEntry.data_sections_used.length > 0 && (
                  <div className="pt-3 border-t border-border/40 text-xs text-muted-foreground">
                    <span className="opacity-70">Seções utilizadas:</span>{' '}
                    {openEntry.data_sections_used.map(s => (
                      <span key={s} className="inline-flex items-center mr-2">
                        ✓ {SECTION_LABELS[s as SectionKey] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
