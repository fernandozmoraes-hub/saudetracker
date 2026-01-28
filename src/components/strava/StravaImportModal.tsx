import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Activity, Bike, Timer, Heart, MapPin, Zap, Check, ChevronRight, Footprints } from 'lucide-react';
import { useStravaConnection } from '@/hooks/useStravaConnection';
import { useEquipment, calculateWearPercentage, getStatusColorClasses } from '@/hooks/useEquipment';
import { StravaActivity, StravaActivityDetails } from '@/types/strava';
import { ZoneDistributionChart } from './ZoneDistributionChart';
import { Link } from 'react-router-dom';

interface StravaImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (activity: StravaActivityDetails, equipmentId?: string) => void;
}

type Step = 'list' | 'details';

export function StravaImportModal({ open, onOpenChange, onImport }: StravaImportModalProps) {
  const { listActivities, getActivityDetails, isConnected } = useStravaConnection();
  const { getActiveEquipment } = useEquipment();
  const [step, setStep] = useState<Step>('list');
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivityDetails | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>();
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const activeEquipment = getActiveEquipment();

  useEffect(() => {
    if (open && isConnected) {
      loadActivities();
    }
  }, [open, isConnected]);

  useEffect(() => {
    if (!open) {
      setStep('list');
      setSelectedActivity(null);
      setSelectedEquipmentId(undefined);
    }
  }, [open]);

  const loadActivities = async () => {
    setIsLoadingList(true);
    try {
      const data = await listActivities();
      setActivities(data);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectActivity = async (activity: StravaActivity) => {
    setIsLoadingDetails(true);
    try {
      const details = await getActivityDetails(activity.id);
      if (details) {
        setSelectedActivity(details);
        setStep('details');
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleConfirmImport = () => {
    if (selectedActivity) {
      onImport(selectedActivity, selectedEquipmentId);
      onOpenChange(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Run': return <Activity className="w-5 h-5" />;
      case 'Bike': return <Bike className="w-5 h-5" />;
      default: return <Timer className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Run': return 'Corrida';
      case 'Bike': return 'Bike';
      case 'Strength': return 'Força';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg" alt="Strava" className="h-5" />
            {step === 'list' ? 'Selecionar Atividade' : 'Confirmar Importação'}
          </DialogTitle>
        </DialogHeader>

        {step === 'list' && (
          <>
            {isLoadingList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando atividades...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma atividade encontrada</p>
                <p className="text-sm">Certifique-se de ter atividades no Strava</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => handleSelectActivity(activity)}
                      disabled={isLoadingDetails}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all text-left"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {getTypeIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{activity.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{format(new Date(activity.date), "d 'de' MMM", { locale: ptBR })}</span>
                          <span>•</span>
                          <span>{getTypeLabel(activity.type)}</span>
                          <span>•</span>
                          <span>{activity.durationMin}min</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {activity.hasHeartrate && (
                          <Heart className="w-4 h-4 text-primary" />
                        )}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}

        {step === 'details' && selectedActivity && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {getTypeIcon(selectedActivity.type)}
              </div>
              <div>
                <p className="font-medium">{selectedActivity.name}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedActivity.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <Timer className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="font-medium">{selectedActivity.durationMin} min</p>
                </div>
              </div>
              
              {selectedActivity.distanceKm && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distância</p>
                    <p className="font-medium">{selectedActivity.distanceKm} km</p>
                  </div>
                </div>
              )}
              
              {selectedActivity.avgHr && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                  <Heart className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">FC Média</p>
                    <p className="font-medium">{selectedActivity.avgHr} bpm</p>
                  </div>
                </div>
              )}

              {selectedActivity.tss !== null && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <Zap className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">TSS Calculado</p>
                    <p className="font-medium text-primary">{selectedActivity.tss}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedActivity.zones && (
              <div className="p-4 rounded-lg border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="font-medium">Distribuição por Zona</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                    HR-TSS (Zonas)
                  </span>
                </div>
                <ZoneDistributionChart 
                  zones={selectedActivity.zones} 
                  totalMin={selectedActivity.durationMin}
                />
              </div>
            )}

            {!selectedActivity.zones && selectedActivity.avgHr && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                <p className="text-yellow-500 font-medium">Dados de zonas não disponíveis</p>
                <p className="text-muted-foreground">
                  Será usado HR-TSS (FC média) com base na FC média de {selectedActivity.avgHr} bpm
                </p>
              </div>
            )}

            {/* Equipment Selection for Run */}
            {selectedActivity.type === 'Run' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-primary" />
                  Tênis Utilizado
                </Label>
                <Select
                  value={selectedEquipmentId || 'none'}
                  onValueChange={(value) => setSelectedEquipmentId(value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tênis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum selecionado</SelectItem>
                    {activeEquipment.map((eq) => {
                      const wearPct = calculateWearPercentage(eq.totalKm, eq.maxKm);
                      const colors = getStatusColorClasses(eq.status);
                      return (
                        <SelectItem key={eq.id} value={eq.id}>
                          <div className="flex items-center gap-2">
                            <span>{eq.name}</span>
                            <span className={`text-xs ${colors.text}`}>
                              ({wearPct.toFixed(0)}%)
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {activeEquipment.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum tênis ativo.{' '}
                    <Link to="/equipment" className="text-primary hover:underline">
                      Adicionar tênis
                    </Link>
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('list')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleConfirmImport}>
                <Check className="w-4 h-4 mr-2" />
                Importar Treino
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
