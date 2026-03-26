import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Heart, Dumbbell, Home, Calendar, Scale, Settings, LayoutDashboard, Users, ClipboardList } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

const athleteNavItems = [
  { path: '/checkin', label: 'Check-in', icon: Heart },
  { path: '/workout', label: 'Treino', icon: Dumbbell },
  { path: '/', label: 'Hoje', icon: Home },
  { path: '/calendar', label: 'Calendário', icon: Calendar },
  { path: '/body-composition', label: 'Corporal', icon: Scale },
  { path: '/settings', label: 'Config', icon: Settings },
];

const coachNavItems = [
  { path: '/coach', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/coach/prescribe', label: 'Prescrever', icon: ClipboardList },
  { path: '/settings', label: 'Config', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const { isCoach, isLoading } = useUserRole();

  // EMENDA 2: fallback para nav de atleta enquanto carrega
  const navItems = (!isLoading && isCoach) ? coachNavItems : athleteNavItems;
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-lg transition-all duration-200',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon 
                className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  isActive && 'scale-110'
                )} 
              />
              <span className="text-xs font-medium">{label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
