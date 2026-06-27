import { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type LoadStatus =
  | 'very_recovered'
  | 'recovered'
  | 'trainable'
  | 'building'
  | 'overload';

interface StatusConfig {
  label: string;
  description: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}

const loadStatusConfig: Record<LoadStatus, StatusConfig> = {
  very_recovered: {
    label: 'Muito Recuperado',
    description: 'Pronto para treinos intensos ou competições.',
    dot: 'bg-primary',
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
  },
  recovered: {
    label: 'Recuperado',
    description: 'Boa recuperação e capacidade de absorver carga.',
    dot: 'bg-status-ok',
    text: 'text-status-ok',
    bg: 'bg-status-ok/10',
    border: 'border-status-ok/30',
  },
  trainable: {
    label: 'Treinável',
    description: 'Zona neutra. Boa relação entre carga e recuperação.',
    dot: 'bg-status-trainable',
    text: 'text-status-trainable',
    bg: 'bg-status-trainable/10',
    border: 'border-status-trainable/30',
  },
  building: {
    label: 'Construção de Fitness',
    description: 'Fase adequada para desenvolvimento físico.',
    dot: 'bg-status-alert',
    text: 'text-status-alert',
    bg: 'bg-status-alert/10',
    border: 'border-status-alert/30',
  },
  overload: {
    label: 'Sobrecarga',
    description: 'Carga elevada. Monitorar recuperação, HRV, sono e fadiga.',
    dot: 'bg-status-critical',
    text: 'text-status-critical',
    bg: 'bg-status-critical/10',
    border: 'border-status-critical/30',
  },
};

interface LoadStatusCardProps {
  tsb: number;
}

export function LoadStatusCard({ tsb }: LoadStatusCardProps) {
  const status = useMemo<LoadStatus>(() => {
    if (tsb > 10) return 'very_recovered';
    if (tsb > 0) return 'recovered';
    if (tsb > -5) return 'trainable';
    if (tsb >= -15) return 'building';
    return 'overload';
  }, [tsb]);

  const config = loadStatusConfig[status];

  return (
    <div
      className={cn(
        'gradient-card rounded-lg p-4 border shadow-card animate-slide-up',
        config.bg,
        config.border
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground font-medium">
          Status de Carga
        </span>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Como o status de carga é calculado"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs max-w-[200px]">
                Status calculado automaticamente a partir do TSB (Training Stress
                Balance).
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
        <span className={cn('text-xl font-display font-bold', config.text)}>
          {config.label}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {config.description}
      </p>
    </div>
  );
}
