import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { useCoachAthletes } from '@/hooks/useCoachAthletes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CoachDashboard() {
  const { activeAthletes, pendingAthletes, isLoading, updateStatus, removeAthlete } = useCoachAthletes();
  const navigate = useNavigate();
  const [inviteEmail, setInviteEmail] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer title="Coach Dashboard" subtitle={`${activeAthletes.length} atleta(s) ativo(s)`}>
      <div className="space-y-6 pb-20">
        {/* Invite Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Convidar Atleta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Para adicionar um atleta, solicite que ele compartilhe seu ID de usuário com você.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="ID do atleta"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                onClick={() => {
                  toast.info('Funcionalidade de convite em desenvolvimento.');
                }}
              >
                Convidar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invites */}
        {pendingAthletes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Convites Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingAthletes.map((athlete) => (
                <div key={athlete.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-foreground">{athlete.athlete_id.slice(0, 8)}...</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(athlete.id, 'active')}>
                      Ativar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeAthlete(athlete.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active Athletes */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Atletas Ativos
          </h2>

          {activeAthletes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Nenhum atleta ativo ainda.</p>
                <p className="text-sm text-muted-foreground mt-1">Convide atletas para começar a monitorar.</p>
              </CardContent>
            </Card>
          ) : (
            activeAthletes.map((athlete) => (
              <Card
                key={athlete.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/coach/athlete/${athlete.athlete_id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-foreground">{athlete.athlete_id.slice(0, 8)}...</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
