import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'coach' | 'athlete';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading, hasRole } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user has no role, redirect to role selection
  if (!hasRole) {
    return <Navigate to="/select-role" replace />;
  }

  // Check required role
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'coach' ? '/coach' : '/'} replace />;
  }

  return <>{children}</>;
}
