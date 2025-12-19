import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDailyCheckByDate, saveDailyCheck } from '@/lib/storage';
import { getHRVBaseline7d, getHRVStatus, getHRVFactor } from '@/lib/calculations';
import { DailyCheck } from '@/types/health';
import { useToast } from '@/hooks/use-toast';
import { Heart, Moon, Brain, Save, Battery } from 'lucide-react';

export default function CheckIn() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Partial<DailyCheck>>({
    date: today,
    hrv: undefined,
    restingHr: undefined,
    sleepHours: undefined,
    sleepQuality: 3,
    mood: 3,
    bodyBattery: undefined,
    notes: '',
  });
  
  const [hrvStatus, setHrvStatus] = useState<{ status: ReturnType<typeof getHRVStatus>; baseline: number } | null>(null);
  
  useEffect(() => {
    const existing = getDailyCheckByDate(today);
    if (existing) {
      setFormData(existing);
    }
  }, [today]);
  
  useEffect(() => {
    if (formData.hrv) {
      const baseline = getHRVBaseline7d(today);
      const status = getHRVStatus(formData.hrv, baseline);
      setHrvStatus({ status, baseline });
    } else {
      setHrvStatus(null);
    }
  }, [formData.hrv, today]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.hrv || !formData.restingHr || !formData.sleepHours || !formData.sleepQuality) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha HRV, FC Repouso, Horas de Sono e Qualidade',
        variant: 'destructive',
      });
      return;
    }
    
    const check: DailyCheck = {
      date: today,
      hrv: formData.hrv,
      restingHr: formData.restingHr,
      sleepHours: formData.sleepHours,
      sleepQuality: formData.sleepQuality,
      mood: formData.mood,
      bodyBattery: formData.bodyBattery,
      notes: formData.notes,
    };
    
    saveDailyCheck(check);
    
    toast({
      title: 'Check-in salvo!',
      description: 'Seus dados de hoje foram registrados.',
    });
  };
  
  const RatingButtons = ({ 
    value, 
    onChange, 
    max = 5 
  }: { 
    value: number | undefined; 
    onChange: (v: number) => void; 
    max?: number;
  }) => (
    <div className="flex gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-lg border transition-all duration-200 font-medium ${
            value === n
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary border-border hover:border-primary/50'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
  
  return (
    <PageContainer 
      title="Check-in Diário" 
      subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
    >
      {hrvStatus && (
        <div className="gradient-card rounded-xl p-6 border border-border/50 mb-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status HRV</p>
              <div className="flex items-center gap-3">
                <StatusBadge status={hrvStatus.status} size="lg" showLabel />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">vs Baseline</p>
              <p className="text-lg font-display font-bold">
                {formData.hrv} / {hrvStatus.baseline || '—'} ms
              </p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hrv" className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              HRV (ms)
            </Label>
            <Input
              id="hrv"
              type="number"
              placeholder="Ex: 45"
              value={formData.hrv || ''}
              onChange={(e) => setFormData({ ...formData, hrv: Number(e.target.value) || undefined })}
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="restingHr" className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-accent" />
              FC Rep (bpm)
            </Label>
            <Input
              id="restingHr"
              type="number"
              placeholder="Ex: 52"
              value={formData.restingHr || ''}
              onChange={(e) => setFormData({ ...formData, restingHr: Number(e.target.value) || undefined })}
              className="text-lg"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sleepHours" className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-primary" />
              Horas de Sono
            </Label>
            <Input
              id="sleepHours"
              type="number"
              step="0.5"
              placeholder="Ex: 7.5"
              value={formData.sleepHours || ''}
              onChange={(e) => setFormData({ ...formData, sleepHours: Number(e.target.value) || undefined })}
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-accent" />
              Qualidade (1-5)
            </Label>
            <RatingButtons 
              value={formData.sleepQuality} 
              onChange={(v) => setFormData({ ...formData, sleepQuality: v })}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bodyBattery" className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-primary" />
              Body Battery
            </Label>
            <Input
              id="bodyBattery"
              type="number"
              placeholder="Ex: 75"
              min={0}
              max={100}
              value={formData.bodyBattery || ''}
              onChange={(e) => setFormData({ ...formData, bodyBattery: Number(e.target.value) || undefined })}
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Humor (1-5)
            </Label>
            <RatingButtons 
              value={formData.mood} 
              onChange={(v) => setFormData({ ...formData, mood: v })}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Como você está se sentindo?"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />
        </div>
        
        <Button type="submit" className="w-full h-12 text-lg font-semibold gap-2">
          <Save className="w-5 h-5" />
          Salvar Check-in
        </Button>
      </form>
    </PageContainer>
  );
}
