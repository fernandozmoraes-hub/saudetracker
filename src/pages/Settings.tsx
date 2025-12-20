import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useToast } from '@/hooks/use-toast';
import { Heart, Save, Info, Loader2 } from 'lucide-react';
import { DEFAULT_LTHR } from '@/lib/calculations';

export default function Settings() {
  const { toast } = useToast();
  const { settings, isLoading, updateLthr } = useUserSettings();
  const [lthr, setLthr] = useState<number>(DEFAULT_LTHR);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLthr(settings.lthr);
    }
  }, [settings.lthr, isLoading]);

  const handleSave = async () => {
    if (lthr < 100 || lthr > 220) {
      toast({
        title: 'Valor inválido',
        description: 'LTHR deve estar entre 100 e 220 bpm',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const success = await updateLthr(lthr);
    setIsSaving(false);

    if (success) {
      toast({
        title: 'Configurações salvas',
        description: `LTHR atualizado para ${lthr} bpm`,
      });
    } else {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Configurações">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer 
      title="Configurações" 
      subtitle="Personalize seus parâmetros de treino"
    >
      {/* LTHR Card */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold">LTHR - FC de Limiar</h3>
            <p className="text-sm text-muted-foreground">
              Frequência cardíaca no limiar de lactato
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lthr">LTHR (bpm)</Label>
          <Input
            id="lthr"
            type="number"
            min={100}
            max={220}
            value={lthr}
            onChange={(e) => setLthr(Number(e.target.value))}
            className="text-lg"
            placeholder="165"
          />
        </div>

        <Button 
          onClick={handleSave}
          disabled={isSaving || lthr === settings.lthr}
          className="w-full"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Info Card */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/30 animate-slide-up">
        <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>O que é LTHR?</strong> É a frequência cardíaca no seu limiar de lactato - 
            o ponto onde o ácido láctico começa a acumular mais rápido do que pode ser removido.
          </p>
          <p>
            <strong>Como descobrir?</strong> Faça um teste de 30 minutos em ritmo máximo sustentável. 
            A FC média dos últimos 20 minutos é uma boa estimativa do seu LTHR.
          </p>
          <p>
            <strong>Para que serve?</strong> O LTHR é usado para calcular o TSS (Training Stress Score) 
            em treinos de endurance como corrida e bike, oferecendo uma métrica mais precisa do que apenas RPE.
          </p>
        </div>
      </div>

      {/* Current Value Display */}
      <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20 animate-slide-up">
        <p className="text-sm text-muted-foreground mb-1">Valor atual</p>
        <p className="text-3xl font-display font-bold text-primary">
          {settings.lthr} <span className="text-lg font-normal text-muted-foreground">bpm</span>
        </p>
      </div>
    </PageContainer>
  );
}
