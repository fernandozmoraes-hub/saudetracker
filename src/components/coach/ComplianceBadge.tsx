import { ComplianceStats } from '@/hooks/useCoachCompliance';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ComplianceBadgeProps {
  stats?: ComplianceStats;
  variant: 'compact' | 'full';
}

function getColor(rate: number) {
  if (rate >= 80) return 'text-green-600';
  if (rate >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getBgColor(rate: number) {
  if (rate >= 80) return 'bg-green-100 text-green-800';
  if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getProgressColor(rate: number) {
  if (rate >= 80) return '[&>div]:bg-green-500';
  if (rate >= 50) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

export function ComplianceBadge({ stats, variant }: ComplianceBadgeProps) {
  if (!stats || stats.total === 0) {
    if (variant === 'compact') return null;
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Sem dados de adesão ainda.</p>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getBgColor(stats.rate)}`}>
          {stats.completed}/{stats.total} este mês
        </span>
        {stats.consecutiveMissed >= 3 && (
          <AlertTriangle className="w-4 h-4 text-orange-500" />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adesão ao Plano (30 dias)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${getColor(stats.rate)}`}>{stats.rate}%</span>
          <Progress value={stats.rate} className={`flex-1 h-3 ${getProgressColor(stats.rate)}`} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{stats.skipped}</p>
            <p className="text-xs text-muted-foreground">Pulados</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{stats.missed}</p>
            <p className="text-xs text-muted-foreground">Não feitos</p>
          </div>
        </div>

        {stats.consecutiveMissed >= 3 && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800">
              Atleta ignorou os últimos {stats.consecutiveMissed} treinos seguidos
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
