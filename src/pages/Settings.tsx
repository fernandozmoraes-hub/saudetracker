import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useStravaConnection } from '@/hooks/useStravaConnection';
import { useToast } from '@/hooks/use-toast';
import { Heart, Save, Info, Loader2, Activity, Dumbbell, Zap, Link2, Unlink, CheckCircle2, Footprints, ChevronRight, Scale, Wine, UserCheck } from 'lucide-react';
import { DEFAULT_LTHR, DEFAULT_ZONE_THRESHOLDS, getHrZones, ZONE_WEIGHTS } from '@/lib/calculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePendingInvites } from '@/hooks/usePendingInvites';
import { toast as sonnerToast } from 'sonner';

export default function Settings() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, isLoading, updateSettings } = useUserSettings();
  const { connection, isLoading: isLoadingStrava, isConnecting, isConnected, connect, disconnect, handleCallback, handleOAuthCallback } = useStravaConnection();
  const { invites, acceptInvite, rejectInvite } = usePendingInvites();

  const handleAcceptInvite = async (id: string) => {
    const err = await acceptInvite(id);
    if (err) sonnerToast.error(err);
    else sonnerToast.success('Convite aceito! Você agora está vinculado ao coach.');
  };

  const handleRejectInvite = async (id: string) => {
    const err = await rejectInvite(id);
    if (err) sonnerToast.error(err);
    else sonnerToast.info('Convite recusado.');
  };
  const [lthr, setLthr] = useState<number>(DEFAULT_LTHR);
  const [restingHr, setRestingHr] = useState<number | undefined>();
  const [maxHr, setMaxHr] = useState<number | undefined>();
  const [zone1Upper, setZone1Upper] = useState<number>(DEFAULT_ZONE_THRESHOLDS.zone1UpperPct);
  const [zone2Upper, setZone2Upper] = useState<number>(DEFAULT_ZONE_THRESHOLDS.zone2UpperPct);
  const [zone3Upper, setZone3Upper] = useState<number>(DEFAULT_ZONE_THRESHOLDS.zone3UpperPct);
  const [zone4Upper, setZone4Upper] = useState<number>(DEFAULT_ZONE_THRESHOLDS.zone4UpperPct);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Handle Strava OAuth callback (new flow with tokens in URL)
  useEffect(() => {
    const stravaSuccess = searchParams.get('strava_success');
    const stravaError = searchParams.get('strava_error');
    const legacyCode = searchParams.get('code');
    const legacyCallback = searchParams.get('strava_callback');
    
    // New flow: tokens are in URL params
    if (stravaSuccess === 'true') {
      const athleteId = searchParams.get('strava_athlete_id');
      const athleteName = searchParams.get('strava_athlete_name');
      const accessToken = searchParams.get('strava_access_token');
      const refreshToken = searchParams.get('strava_refresh_token');
      const expiresAt = searchParams.get('strava_expires_at');
      const scope = searchParams.get('strava_scope');

      if (athleteId && accessToken && refreshToken && expiresAt) {
        handleOAuthCallback({
          athleteId,
          athleteName: athleteName || 'Atleta Strava',
          accessToken,
          refreshToken,
          expiresAt,
          scope: scope || 'read,activity:read_all',
        }).then((success) => {
          if (success) {
            toast({ title: 'Strava conectado!', description: 'Agora você pode importar atividades.' });
          } else {
            toast({ title: 'Erro ao salvar conexão', description: 'Tente novamente.', variant: 'destructive' });
          }
          // Clear URL params
          setSearchParams({});
        });
      }
    } else if (stravaError) {
      toast({ 
        title: 'Erro na conexão Strava', 
        description: `Erro: ${stravaError}`, 
        variant: 'destructive' 
      });
      setSearchParams({});
    }
    // Legacy flow: code in URL
    else if (legacyCode && legacyCallback) {
      handleCallback(legacyCode).then((success) => {
        if (success) {
          toast({ title: 'Strava conectado!', description: 'Agora você pode importar atividades.' });
        } else {
          toast({ title: 'Erro ao conectar', description: 'Não foi possível conectar ao Strava.', variant: 'destructive' });
        }
        setSearchParams({});
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading) {
      setLthr(settings.lthr);
      setRestingHr(settings.restingHr);
      setMaxHr(settings.maxHr);
      setZone1Upper(settings.zone1UpperPct);
      setZone2Upper(settings.zone2UpperPct);
      setZone3Upper(settings.zone3UpperPct);
      setZone4Upper(settings.zone4UpperPct);
    }
  }, [settings, isLoading]);

  const hasChanges = 
    lthr !== settings.lthr ||
    restingHr !== settings.restingHr ||
    maxHr !== settings.maxHr ||
    zone1Upper !== settings.zone1UpperPct ||
    zone2Upper !== settings.zone2UpperPct ||
    zone3Upper !== settings.zone3UpperPct ||
    zone4Upper !== settings.zone4UpperPct;

  const handleSave = async () => {
    if (lthr < 100 || lthr > 220) {
      toast({
        title: 'Valor inválido',
        description: 'LTHR deve estar entre 100 e 220 bpm',
        variant: 'destructive',
      });
      return;
    }

    // Validate zone thresholds are in order
    if (zone1Upper >= zone2Upper || zone2Upper >= zone3Upper || zone3Upper >= zone4Upper) {
      toast({
        title: 'Zonas inválidas',
        description: 'Os limites das zonas devem estar em ordem crescente',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const success = await updateSettings({
      lthr,
      restingHr,
      maxHr,
      zone1UpperPct: zone1Upper,
      zone2UpperPct: zone2Upper,
      zone3UpperPct: zone3Upper,
      zone4UpperPct: zone4Upper,
    });
    setIsSaving(false);

    if (success) {
      toast({
        title: 'Configurações salvas',
        description: 'Parâmetros de treino atualizados',
      });
    } else {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive',
      });
    }
  };

  const handleResetZones = () => {
    setZone1Upper(DEFAULT_ZONE_THRESHOLDS.zone1UpperPct);
    setZone2Upper(DEFAULT_ZONE_THRESHOLDS.zone2UpperPct);
    setZone3Upper(DEFAULT_ZONE_THRESHOLDS.zone3UpperPct);
    setZone4Upper(DEFAULT_ZONE_THRESHOLDS.zone4UpperPct);
  };

  // Calculate zones for display
  const zones = getHrZones(lthr, zone1Upper, zone2Upper, zone3Upper, zone4Upper);

  const handleDisconnectStrava = async () => {
    setIsDisconnecting(true);
    const success = await disconnect();
    setIsDisconnecting(false);
    if (success) {
      toast({ title: 'Strava desconectado' });
    } else {
      toast({ title: 'Erro ao desconectar', variant: 'destructive' });
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
      {/* Convites Pendentes de Coach */}
      {invites.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Convites de Coach
              <Badge variant="default" className="ml-auto">{invites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {invite.coach_name ?? invite.coach_email ?? 'Coach'}
                  </p>
                  {invite.coach_email && invite.coach_name && (
                    <p className="text-xs text-muted-foreground truncate">{invite.coach_email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">quer te acompanhar como atleta</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleAcceptInvite(invite.id)}>
                    Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRejectInvite(invite.id)}>
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Parâmetros Fisiológicos */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Parâmetros Fisiológicos</h3>
            <p className="text-sm text-muted-foreground">
              Configure sua frequência cardíaca
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lthr" className="flex items-center gap-1">
              LTHR (bpm)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">FC de limiar de lactato. Base para cálculo das zonas.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
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

          <div className="space-y-2">
            <Label htmlFor="restingHr">FC Repouso (opcional)</Label>
            <Input
              id="restingHr"
              type="number"
              min={30}
              max={100}
              value={restingHr || ''}
              onChange={(e) => setRestingHr(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="55"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxHr">FC Máxima (opcional)</Label>
            <Input
              id="maxHr"
              type="number"
              min={150}
              max={220}
              value={maxHr || ''}
              onChange={(e) => setMaxHr(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="190"
            />
          </div>
        </div>
      </div>

      {/* Zonas de FC */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Zonas de Frequência Cardíaca</h3>
              <p className="text-sm text-muted-foreground">
                Limites em % do LTHR (editáveis)
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleResetZones}>
            Reset
          </Button>
        </div>

        <div className="space-y-3">
          {/* Zone headers */}
          <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium px-1">
            <span>Zona</span>
            <span>Faixa (%)</span>
            <span>Limite Superior</span>
            <span>FC (bpm)</span>
            <span>Peso</span>
          </div>

          {/* Z1 */}
          <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="font-medium text-blue-400">Z1</span>
            <span className="text-sm text-muted-foreground">0–{zone1Upper}%</span>
            <Input
              type="number"
              min={50}
              max={zone2Upper - 1}
              value={zone1Upper}
              onChange={(e) => setZone1Upper(Number(e.target.value))}
              className="h-8 text-sm"
            />
            <span className="text-sm">≤ {zones[0].upperBpm}</span>
            <span className="text-sm font-medium">{ZONE_WEIGHTS[1]}</span>
          </div>

          {/* Z2 */}
          <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <span className="font-medium text-green-400">Z2</span>
            <span className="text-sm text-muted-foreground">{zone1Upper + 1}–{zone2Upper}%</span>
            <Input
              type="number"
              min={zone1Upper + 1}
              max={zone3Upper - 1}
              value={zone2Upper}
              onChange={(e) => setZone2Upper(Number(e.target.value))}
              className="h-8 text-sm"
            />
            <span className="text-sm">{zones[1].lowerBpm}–{zones[1].upperBpm}</span>
            <span className="text-sm font-medium">{ZONE_WEIGHTS[2]}</span>
          </div>

          {/* Z3 */}
          <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <span className="font-medium text-yellow-400">Z3</span>
            <span className="text-sm text-muted-foreground">{zone2Upper + 1}–{zone3Upper}%</span>
            <Input
              type="number"
              min={zone2Upper + 1}
              max={zone4Upper - 1}
              value={zone3Upper}
              onChange={(e) => setZone3Upper(Number(e.target.value))}
              className="h-8 text-sm"
            />
            <span className="text-sm">{zones[2].lowerBpm}–{zones[2].upperBpm}</span>
            <span className="text-sm font-medium">{ZONE_WEIGHTS[3]}</span>
          </div>

          {/* Z4 */}
          <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <span className="font-medium text-orange-400">Z4</span>
            <span className="text-sm text-muted-foreground">{zone3Upper + 1}–{zone4Upper}%</span>
            <Input
              type="number"
              min={zone3Upper + 1}
              max={110}
              value={zone4Upper}
              onChange={(e) => setZone4Upper(Number(e.target.value))}
              className="h-8 text-sm"
            />
            <span className="text-sm">{zones[3].lowerBpm}–{zones[3].upperBpm}</span>
            <span className="text-sm font-medium">{ZONE_WEIGHTS[4]}</span>
          </div>

          {/* Z5 */}
          <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="font-medium text-red-400">Z5</span>
            <span className="text-sm text-muted-foreground">≥{zone4Upper + 1}%</span>
            <span className="text-sm text-muted-foreground px-3">—</span>
            <span className="text-sm">≥ {zones[4].lowerBpm}</span>
            <span className="text-sm font-medium">{ZONE_WEIGHTS[5]}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Pesos baseados no modelo TrainingPeaks. A fórmula HR-TSS (Zonas) é: Σ (horas × peso²) × 100
        </p>
      </div>

      {/* Active Model Banner */}
      <div className="gradient-card rounded-xl p-5 border border-primary/30 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Modelo de Carga Ativo</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">v2 Híbrido</span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/70 flex-1">
            <Heart className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Endurance</p>
              <p className="text-xs text-muted-foreground">HR-TSS (Zonas ou FC média)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/70 flex-1">
            <Dumbbell className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Força</p>
              <p className="text-xs text-muted-foreground">via RPE (RPE-TSS)</p>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Modelo Híbrido v2:</strong> Combina a precisão do HR-TSS para treinos de endurance 
            (corrida, bike) com o RPE-TSS para treinos de força.
          </p>
          <p>
            <strong>HR-TSS por Zonas</strong> utiliza o tempo em cada zona de FC para cálculo preciso. 
            <strong>HR-TSS por FC média</strong> é usado quando não há dados de zonas.
          </p>
        </div>
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
          <p className="text-xs italic">
            Este cálculo é inspirado no HR-TSS do TrainingPeaks, mas pode apresentar pequenas diferenças.
          </p>
        </div>
      </div>

      {/* Equipment Section */}
      <Link to="/equipment">
        <div className="gradient-card rounded-xl p-5 border border-border/50 hover:border-primary/50 transition-all animate-slide-up cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Footprints className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Equipamentos</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie seus tênis de corrida
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </Link>

      {/* Alcohol Intake Section */}
      <Link to="/alcohol-intake">
        <div className="gradient-card rounded-xl p-5 border border-border/50 hover:border-primary/50 transition-all animate-slide-up cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Wine className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Consumo de Álcool</h3>
                <p className="text-sm text-muted-foreground">
                  Monitore cerveja e vinho
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </Link>


      {/* Strava Integration */}
      <div className="gradient-card rounded-xl p-6 border border-border/50 space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg" alt="Strava" className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold">Integração Strava</h3>
            <p className="text-sm text-muted-foreground">
              Importe atividades com dados de FC por zona
            </p>
          </div>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">
              <CheckCircle2 className="w-3 h-3" />
              Conectado
            </span>
          )}
        </div>

        {isLoadingStrava ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isConnected ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
            <div>
              <p className="font-medium">{connection?.athlete_name || 'Atleta Strava'}</p>
              <p className="text-sm text-muted-foreground">ID: {connection?.strava_athlete_id}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDisconnectStrava}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 mr-1" />}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Strava para importar atividades automaticamente com dados de frequência cardíaca por zona.
            </p>
            <Button onClick={connect} disabled={isConnecting} className="w-full">
              {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Conectar com Strava
            </Button>
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button 
        onClick={handleSave}
        disabled={isSaving || !hasChanges}
        className="w-full"
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar Configurações
      </Button>

      {/* Current Value Display */}
      <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20 animate-slide-up">
        <p className="text-sm text-muted-foreground mb-1">LTHR atual</p>
        <p className="text-3xl font-display font-bold text-primary">
          {settings.lthr} <span className="text-lg font-normal text-muted-foreground">bpm</span>
        </p>
      </div>
    </PageContainer>
  );
}
