import { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useBodyComposition } from '@/hooks/useBodyComposition';
import { useData } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  movingAverage7d,
  calculateTrend30d,
  getMuscleIntegrityStatus,
  getTrainingCorrelation,
  calculateMuscleIntegrityIndex,
  Trend30d,
} from '@/lib/bodyCompositionCalcs';
import { MuscleIntegrityStatus, DataSource } from '@/types/health';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Plus, Loader2, Scale, Trash2, AlertTriangle, ShieldCheck, ShieldAlert, Shield,
  TrendingDown, TrendingUp, Minus, Flag, FlagOff, Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<MuscleIntegrityStatus, { label: string; color: string; icon: typeof ShieldCheck; bgClass: string }> = {
  preserved: { label: 'Integridade Preservada', color: 'text-green-400', icon: ShieldCheck, bgClass: 'bg-green-500/10 border-green-500/30' },
  declining: { label: 'Tendência de Perda', color: 'text-yellow-400', icon: ShieldAlert, bgClass: 'bg-yellow-500/10 border-yellow-500/30' },
  at_risk: { label: 'Perda Muscular Relevante', color: 'text-red-400', icon: Shield, bgClass: 'bg-red-500/10 border-red-500/30' },
};

export default function BodyComposition() {
  const { toast } = useToast();
  const { entries, isLoading, saveEntry, deleteEntry, toggleInconsistent, getLatest, getFilteredEntries } = useBodyComposition();
  const { workouts } = useData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<number>(90);
  const [agentAnalysis, setAgentAnalysis] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWeight, setFormWeight] = useState('');
  const [formMuscle, setFormMuscle] = useState('');
  const [formFat, setFormFat] = useState('');
  const [formSource, setFormSource] = useState<DataSource>('manual');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Calculations
  const latest = getLatest;
  const today = new Date().toISOString().split('T')[0];

  const avgWeight = useMemo(() => latest ? movingAverage7d(entries, 'weightKg', today) : null, [entries, latest, today]);
  const avgMuscle = useMemo(() => latest ? movingAverage7d(entries, 'muscleMassKg', today) : null, [entries, latest, today]);
  const avgFat = useMemo(() => latest ? movingAverage7d(entries, 'bodyFatPct', today) : null, [entries, latest, today]);

  const trend30d = useMemo(() => calculateTrend30d(entries, 'muscleMassKg'), [entries]);

  const entries60d = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return entries.filter(e => e.date >= cutoffStr);
  }, [entries]);

  const status = useMemo(() => getMuscleIntegrityStatus(trend30d, entries60d), [trend30d, entries60d]);
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const trainingCorr = useMemo(() => getTrainingCorrelation(workouts, 30), [workouts]);

  const leanMassRatio = latest && latest.weightKg > 0 ? latest.muscleMassKg / latest.weightKg : 0;
  const integrityIndex = calculateMuscleIntegrityIndex(leanMassRatio, trend30d, trainingCorr.weeklyTss);

  // Chart data
  const chartData = useMemo(() => {
    return getFilteredEntries(chartPeriod).map(e => ({
      date: format(new Date(e.date), 'dd/MM'),
      Peso: e.weightKg,
      'Massa Muscular': e.muscleMassKg,
      '% Gordura': e.bodyFatPct,
    }));
  }, [getFilteredEntries, chartPeriod]);

  const handleSave = async () => {
    if (!formWeight || !formMuscle || !formFat) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const ok = await saveEntry({
      date: formDate,
      weightKg: parseFloat(formWeight),
      muscleMassKg: parseFloat(formMuscle),
      bodyFatPct: parseFloat(formFat),
      dataSource: formSource,
      notes: formNotes || undefined,
    });
    setIsSaving(false);
    if (ok) {
      toast({ title: 'Medição salva!' });
      setSheetOpen(false);
      setFormWeight(''); setFormMuscle(''); setFormFat(''); setFormNotes('');
      setFormDate(new Date().toISOString().split('T')[0]);
    }
  };

  const requestAgentAnalysis = async () => {
    setAgentLoading(true);
    setAgentAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke('muscle-integrity-agent', {
        body: {},
      });
      if (error) throw error;
      setAgentAnalysis(data?.analysis || 'Não foi possível gerar a análise.');
    } catch (err: any) {
      console.error('Agent error:', err);
      toast({ title: 'Erro ao consultar agente', description: err.message, variant: 'destructive' });
    } finally {
      setAgentLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Composição Corporal">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Composição Corporal" subtitle="Monitoramento de tendências corporais">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up">
        <div className="gradient-card rounded-xl p-4 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Peso (7d)</p>
          <p className="text-xl font-display font-bold">
            {avgWeight ? `${avgWeight.toFixed(1)} kg` : '—'}
          </p>
        </div>
        <div className="gradient-card rounded-xl p-4 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Massa Muscular (7d)</p>
          <p className="text-xl font-display font-bold">
            {avgMuscle ? `${avgMuscle.toFixed(1)} kg` : '—'}
          </p>
        </div>
        <div className="gradient-card rounded-xl p-4 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">% Gordura (7d)</p>
          <p className="text-xl font-display font-bold">
            {avgFat ? `${avgFat.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${statusConfig.bgClass}`}>
          <p className="text-xs text-muted-foreground mb-1">Integridade Muscular</p>
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            <p className={`text-sm font-display font-bold ${statusConfig.color}`}>
              {statusConfig.label}
            </p>
          </div>
        </div>
      </div>

      {/* Trend info */}
      {trend30d && (
        <div className="gradient-card rounded-xl p-4 border border-border/50 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            {trend30d.percentChange < -0.5 ? (
              <TrendingDown className="w-4 h-4 text-red-400" />
            ) : trend30d.percentChange > 0.5 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <Minus className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Tendência 30 dias (Massa Muscular)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Variação</p>
              <p className="font-medium">{trend30d.absoluteChange > 0 ? '+' : ''}{trend30d.absoluteChange.toFixed(2)} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Percentual</p>
              <p className="font-medium">{trend30d.percentChange > 0 ? '+' : ''}{trend30d.percentChange.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Slope</p>
              <p className="font-medium">{(trend30d.slope * 1000).toFixed(2)} g/dia</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="gradient-card rounded-xl p-4 border border-border/50 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">Gráfico Longitudinal</h3>
            <div className="flex gap-1">
              {[30, 90, 180].map(d => (
                <Button
                  key={d}
                  variant={chartPeriod === d ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setChartPeriod(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} domain={['auto', 'auto']} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222 47% 11%)',
                    border: '1px solid hsl(222 30% 20%)',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line yAxisId="left" type="monotone" dataKey="Peso" stroke="hsl(174 72% 56%)" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="Massa Muscular" stroke="hsl(142 76% 45%)" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="% Gordura" stroke="hsl(16 85% 60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent Analysis */}
      <div className="gradient-card rounded-xl p-5 border border-border/50 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Avaliação do Agente</h3>
          </div>
          <Button size="sm" onClick={requestAgentAnalysis} disabled={agentLoading || entries.length < 2}>
            {agentLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {agentLoading ? 'Analisando...' : 'Analisar'}
          </Button>
        </div>

        {agentAnalysis ? (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusConfig.bgClass}`}>
              <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
              <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
            <div className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
              {agentAnalysis}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {entries.length < 2
              ? 'Registre ao menos 2 medições para habilitar a análise.'
              : 'Clique em "Analisar" para obter a avaliação do agente de integridade muscular.'}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-3 italic border-t border-border/30 pt-2">
          Esta análise é baseada em tendências e não substitui avaliação médica.
        </p>
      </div>

      {/* Add Entry Button */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Nova Medição
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Registrar Medição</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" placeholder="70.5" value={formWeight} onChange={e => setFormWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Massa Muscular (kg)</Label>
                <Input type="number" step="0.1" placeholder="32.0" value={formMuscle} onChange={e => setFormMuscle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>% Gordura</Label>
                <Input type="number" step="0.1" placeholder="18.5" value={formFat} onChange={e => setFormFat(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={formSource} onValueChange={(v: DataSource) => setFormSource(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="smart_scale">Balança Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea placeholder="Notas sobre a medição..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
              Salvar Medição
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* History */}
      {entries.length > 0 && (
        <div className="space-y-2 animate-slide-up">
          <h3 className="font-display font-semibold text-sm">Histórico</h3>
          {entries.slice(0, 20).map(e => (
            <div
              key={e.id}
              className={`gradient-card rounded-xl p-4 border ${e.flaggedInconsistent ? 'border-yellow-500/30 opacity-60' : 'border-border/50'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {format(new Date(e.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {e.dataSource === 'smart_scale' ? 'Balança' : 'Manual'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                <div>
                  <p className="text-xs text-muted-foreground">Peso</p>
                  <p className="font-medium">{e.weightKg.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Massa Muscular</p>
                  <p className="font-medium">{e.muscleMassKg.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">% Gordura</p>
                  <p className="font-medium">{e.bodyFatPct.toFixed(1)}%</p>
                </div>
              </div>
              {e.notes && <p className="text-xs text-muted-foreground mb-2">{e.notes}</p>}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleInconsistent(e.id)}
                >
                  {e.flaggedInconsistent ? (
                    <><FlagOff className="w-3 h-3 mr-1" /> Desmarcar</>
                  ) : (
                    <><Flag className="w-3 h-3 mr-1" /> Inconsistente</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => deleteEntry(e.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
