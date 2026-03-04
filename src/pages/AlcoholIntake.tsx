import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAlcoholIntake } from '@/hooks/useAlcoholIntake';
import { useToast } from '@/hooks/use-toast';
import {
  calculateAlcoholGrams,
  getDefaultAbv,
  getAlcoholImpact,
  getImpactLabel,
  getImpactColor,
  getImpactBgColor,
  getWeeklyStats,
  getDailyTotal,
} from '@/lib/alcoholCalcs';
import { DrinkType } from '@/types/health';
import { Wine, Beer, Plus, Trash2, Loader2, TrendingDown, Calendar } from 'lucide-react';

export default function AlcoholIntake() {
  const { toast } = useToast();
  const { entries, isLoading, saveEntry, deleteEntry } = useAlcoholIntake();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [drinkType, setDrinkType] = useState<DrinkType>('beer');
  const [volumeMl, setVolumeMl] = useState<number>(350);
  const [numDrinks, setNumDrinks] = useState<number>(1);
  const [abvPercent, setAbvPercent] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const calculatedGrams = calculateAlcoholGrams(volumeMl, numDrinks, abvPercent);
  const impact = getAlcoholImpact(calculatedGrams);

  const weeklyStats = useMemo(() => getWeeklyStats(entries), [entries]);

  // Group entries by date for history
  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    entries.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14); // last 14 days with entries
  }, [entries]);

  const handleDrinkTypeChange = (value: DrinkType) => {
    setDrinkType(value);
    setAbvPercent(getDefaultAbv(value));
    setVolumeMl(value === 'beer' ? 350 : 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (volumeMl <= 0 || numDrinks <= 0 || abvPercent <= 0) {
      toast({ title: 'Valores inválidos', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const success = await saveEntry({
      date,
      time: time || undefined,
      drinkType,
      volumeMl,
      numDrinks,
      abvPercent,
      alcoholGrams: calculatedGrams,
      notes: notes || undefined,
    });
    setIsSaving(false);

    if (success) {
      toast({ title: 'Registro salvo!' });
      setNumDrinks(1);
      setNotes('');
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteEntry(id);
    if (success) {
      toast({ title: 'Registro removido' });
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Consumo de Álcool">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="🍷 Consumo de Álcool" subtitle="Monitoramento fisiológico">
      {/* Weekly Dashboard */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 animate-slide-up">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-primary" />
          Resumo Semanal
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-lg p-3 ${getImpactBgColor(weeklyStats.weeklyImpact)}`}>
            <p className="text-xs text-muted-foreground">Total Semanal</p>
            <p className={`text-2xl font-bold ${getImpactColor(weeklyStats.weeklyImpact)}`}>
              {Math.round(weeklyStats.weeklyTotal)}g
            </p>
          </div>
          <div className="rounded-lg p-3 bg-secondary">
            <p className="text-xs text-muted-foreground">Média Diária</p>
            <p className={`text-2xl font-bold ${getImpactColor(weeklyStats.weeklyImpact)}`}>
              {weeklyStats.dailyAverage}g
            </p>
          </div>
          <div className="rounded-lg p-3 bg-secondary">
            <p className="text-xs text-muted-foreground">Dias Sem Consumo</p>
            <p className="text-2xl font-bold text-green-500">{weeklyStats.consecutiveDryDays}</p>
          </div>
          <div className={`rounded-lg p-3 ${getImpactBgColor(weeklyStats.weeklyImpact)}`}>
            <p className="text-xs text-muted-foreground">Classificação</p>
            <p className={`text-lg font-bold ${getImpactColor(weeklyStats.weeklyImpact)}`}>
              {getImpactLabel(weeklyStats.weeklyImpact)}
            </p>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Registrar Consumo
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Data
            </Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Horário (opcional)</Label>
            <Input id="time" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de Bebida</Label>
          <Select value={drinkType} onValueChange={v => handleDrinkTypeChange(v as DrinkType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beer">
                <span className="flex items-center gap-2">🍺 Cerveja</span>
              </SelectItem>
              <SelectItem value="wine">
                <span className="flex items-center gap-2">🍷 Vinho</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="volume">Volume (ml)</Label>
            <Input
              id="volume"
              type="number"
              min={1}
              placeholder={drinkType === 'beer' ? '350' : '150'}
              value={volumeMl}
              onChange={e => setVolumeMl(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numDrinks">Doses</Label>
            <Input
              id="numDrinks"
              type="number"
              min={1}
              value={numDrinks}
              onChange={e => setNumDrinks(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abv">ABV %</Label>
            <Input
              id="abv"
              type="number"
              step="0.1"
              min={0}
              value={abvPercent}
              onChange={e => setAbvPercent(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Calculated grams display */}
        <div className={`rounded-lg p-4 ${getImpactBgColor(impact)} border border-border/30`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gramas de Álcool</span>
            <span className={`text-2xl font-bold ${getImpactColor(impact)}`}>{calculatedGrams}g</span>
          </div>
          <p className={`text-sm font-medium mt-1 ${getImpactColor(impact)}`}>
            Impacto: {getImpactLabel(impact)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Observações..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Registrar
        </Button>
      </form>

      {/* History */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <h3 className="font-display font-semibold">Histórico</h3>

        {groupedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
        ) : (
          groupedEntries.map(([groupDate, dayEntries]) => {
            const dayTotal = getDailyTotal(dayEntries, groupDate);
            const dayImpact = getAlcoholImpact(dayTotal);
            return (
              <div key={groupDate} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {format(new Date(groupDate + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getImpactBgColor(dayImpact)} ${getImpactColor(dayImpact)}`}>
                    {Math.round(dayTotal)}g — {getImpactLabel(dayImpact)}
                  </span>
                </div>
                {dayEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/30">
                    <div className="flex items-center gap-2">
                      <span>{entry.drinkType === 'beer' ? '🍺' : '🍷'}</span>
                      <div>
                        <p className="text-sm font-medium">
                          {entry.numDrinks}× {entry.volumeMl}ml ({entry.abvPercent}%)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(entry.alcoholGrams * 10) / 10}g
                          {entry.time ? ` · ${entry.time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
