import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  className?: string;
}

export function PageContainer({ children, title, subtitle, className }: PageContainerProps) {
  return (
    <div className={cn('min-h-screen pb-20 pt-6 px-4 max-w-lg mx-auto', className)}>
      {(title || subtitle) && (
        <header className="mb-6 animate-fade-in">
          {title && (
            <h1 className="text-2xl font-display font-bold text-foreground">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </header>
      )}
      <main className="space-y-4">{children}</main>
    </div>
  );
}
