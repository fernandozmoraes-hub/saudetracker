import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { ComplianceStats } from '@/hooks/useCoachCompliance';

interface ComplianceBadgeProps {
  stats: ComplianceStats;
  /** 'compact' para cards do dashboard, 'full' para o perfil do atleta */
  variant?: 'compact' | 'full';
}

function getRateColor(rate: number | null) {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 80) return 'text-green-500';
  if (rate >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getRateBg(rate: number | null) {
  if (rate === null) return 'bg-muted/50';
  if (rate >= 80) return 'bg-green-500/10 border-green-500/30';
  if (rate >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function getRateBarColor(rate: number | null) {
  if (rate === null) return 'bg-muted';
  if (rate >= 80) return 'bg-green-500';
  if (rate >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/** Badge compacto para card do dashboard */
function CompactBadge({ stats }: { stats: ComplianceStats }) {
  const { total, completed, rate, consecutiveMissed } = stats;
  const isIgnoring = consecutiveMissed >= 3;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {isIgnoring && (
        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
      )}
      <span
        className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full border',
          getRateBg(rate),
          getRateColor(rate),
        )}
      >
        {completed}/{total} este mês
      </span>
    </div>
  );
}

/** Card completo para o perfil do atleta */
function FullCard({ stats }: { stats: ComplianceStats }) {
  const { total, completed, skipped, missed, rate, consecutiveMissed } = stats;
  const isIgnoring = consecutiveMissed >= 3;

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum treino prescrito nos últimos 30 dias.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerta de ignorando o plano */}
      {isIgnoring && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-400">
            Atleta ignorou os últimos <strong>{consecutiveMissed}</strong> treinos seguidos.
          </p>
        </div>
      )}

      {/* Taxa principal */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={cn('text-3xl font-bold', getRateColor(rate))}>
            {rate !== null ? `${rate}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">de adesão este mês</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium',
            getRateBg(rate),
            getRateColor(rate),
          )}
        >
          {rate !== null && rate >= 80 ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          {completed}/{total} treinos
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', getRateBarColor(rate))}
            style={{ width: `${rate ?? 0}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-green-500/10 space-y-0.5">
          <p className="text-base font-bold text-green-400">{completed}</p>
          <p className="text-[11px] text-muted-foreground">Concluídos</p>
        </div>
        <div className="p-2 rounded-lg bg-red-500/10 space-y-0.5">
          <p className="text-base font-bold text-red-400">{skipped}</p>
          <p className="text-[11px] text-muted-foreground">Pulados</p>
        </div>
        <div className="p-2 rounded-lg bg-orange-500/10 space-y-0.5">
          <p className="text-base font-bold text-orange-400">{missed}</p>
          <p className="text-[11px] text-muted-foreground">Não feitos</p>
        </div>
      </div>
    </div>
  );
}

export function ComplianceBadge({ stats, variant = 'compact' }: ComplianceBadgeProps) {
  if (variant === 'full') return <FullCard stats={stats} />;
  return <CompactBadge stats={stats} />;
}
