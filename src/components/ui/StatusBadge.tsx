import { cn } from '@/lib/utils';
import { HRVStatus } from '@/types/health';

interface StatusBadgeProps {
  status: HRVStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig = {
  OK: {
    bg: 'bg-status-ok',
    text: 'text-status-ok',
    label: 'OK',
    ring: 'ring-status-ok/30',
  },
  Alert: {
    bg: 'bg-status-alert',
    text: 'text-status-alert',
    label: 'Alerta',
    ring: 'ring-status-alert/30',
  },
  Critical: {
    bg: 'bg-status-critical',
    text: 'text-status-critical',
    label: 'Crítico',
    ring: 'ring-status-critical/30',
  },
};

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
};

export function StatusBadge({ status, size = 'md', showLabel = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          'rounded-full ring-4 animate-pulse-glow',
          sizeClasses[size],
          config.bg,
          config.ring
        )}
      />
      {showLabel && (
        <span className={cn('font-medium', config.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
