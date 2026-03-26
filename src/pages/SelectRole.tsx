import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Dumbbell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SelectRole() {
  const { setRole } = useUserRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSelect = async (role: 'coach' | 'athlete') => {
    setSaving(true);
    const success = await setRole(role);
    if (success) {
      toast.success(role === 'coach' ? 'Modo Coach ativado!' : 'Modo Atleta ativado!');
      navigate(role === 'coach' ? '/coach' : '/');
    } else {
      toast.error('Erro ao definir perfil. Tente novamente.');
    }
    setSaving(false);
  };

  return (
    <PageContainer title="Bem-vindo!" subtitle="Como você quer usar o app?">
      <div className="flex flex-col gap-4 max-w-md mx-auto pt-8 pb-20">
        <Card
          className="cursor-pointer border-2 border-transparent hover:border-primary transition-colors"
          onClick={() => !saving && handleSelect('athlete')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Dumbbell className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Sou Atleta</h3>
              <p className="text-sm text-muted-foreground">
                Registre treinos, acompanhe métricas e receba análises personalizadas.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 border-transparent hover:border-primary transition-colors"
          onClick={() => !saving && handleSelect('coach')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Users className="w-8 h-8 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Sou Coach</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie atletas, prescreva treinos e monitore performance.
              </p>
            </div>
          </CardContent>
        </Card>

        {saving && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
