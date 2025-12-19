import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
  valueClassName?: string;
}

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const trendColors = {
  up: 'text-status-ok',
  down: 'text-status-critical',
  stable: 'text-muted-foreground',
};

export function MetricCard({ 
  label, 
  value, 
  unit, 
  icon, 
  trend, 
  className,
  valueClassName 
}: MetricCardProps) {
  return (
    <div 
      className={cn(
        'gradient-card rounded-lg p-4 border border-border/50 shadow-card animate-slide-up',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-display font-bold', valueClassName)}>
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        {trend && (
          <span className={cn('ml-2 text-lg', trendColors[trend])}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
    </div>
  );
}
