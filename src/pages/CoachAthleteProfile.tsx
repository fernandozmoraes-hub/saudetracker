import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { ArrowLeft, Loader2, Heart, Activity, TrendingUp, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlans, TrainingPlan } from '@/hooks/useTrainingPlans';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

interface AthleteData {
  dailyChecks: any[];
  workouts: any[];
  latestCheck: any | null;
}

interface AthleteProfile {
  display_name?: string;
  email?: string;
}

export default function CoachAthleteProfile() {
  const { id: athleteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans } = useTrainingPlans(athleteId);
  const [data, setData] = useState<AthleteData>({ dailyChecks: [], workouts: [], latestCheck: null });
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !athleteId) return;

    const fetchAthleteData = async () => {
      setIsLoading(true);
      try {
        const last30 = format(subDays(new Date(), 30), 'yyyy-MM-dd');

        const [checksRes, workoutsRes, profileRes] = await Promise.all([
          supabase
            .from('daily_checks')
            .select('*')
            .eq('user_id', athleteId)
            .gte('date', last30)
            .order('date', { ascending: false }),
          supabase
            .from('workouts')
            .select('*')
            .eq('user_id', athleteId)
            .gte('date', last30)
            .order('date', { ascending: false }),
          supabase
            .from('profiles')
            .select('display_name, email')
            .eq('user_id', athleteId)
            .maybeSingle(),
        ]);

        if (checksRes.error) throw checksRes.error;
        if (workoutsRes.error) throw workoutsRes.error;

        setAthleteProfile((profileRes.data as AthleteProfile) ?? {});
        setData({
          dailyChecks: checksRes.data || [],
          workouts: workoutsRes.data || [],
          latestCheck: checksRes.data?.[0] || null,
        });
      } catch (err) {
        console.error('Error fetching athlete data:', err);
        toast.error('Erro ao carregar dados do atleta. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAthleteData();
  }, [user, athleteId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { latestCheck, workouts, dailyChecks } = data;

  const athleteLabel =
    athleteProfile.display_name ??
    athleteProfile.email ??
    (athleteId?.slice(0, 8) + '...');

  // Calculate HRV baseline (7-day average)
  const recentHrvs = dailyChecks.slice(0, 7).map((c) => c.hrv).filter(Boolean);
  const hrvBaseline =
    recentHrvs.length > 0
      ? Math.round(recentHrvs.reduce((a: number, b: number) => a + b, 0) / recentHrvs.length)
      : null;

  // Weekly TSS
  const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const weeklyTSS = workouts
    .filter((w: any) => w.date >= last7Days)
    .reduce((sum: number, w: any) => sum + (Number(w.tss_final) || Number(w.tss_subjective) || 0), 0);

  const recentPlans = plans.slice(0, 5);

  return (
    <PageContainer title="Perfil do Atleta" subtitle={athleteLabel}>
      <div className="space-y-4 pb-20">
        <Button variant="ghost" size="sm" onClick={() => navigate('/coach')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        {/* Athlete identity */}
        {athleteProfile.email && (
          <div className="px-1">
            <p className="text-sm text-muted-foreground">{athleteProfile.email}</p>
          </div>
        )}

        {/* Metrics Overview */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="HRV Atual"
            value={latestCheck?.hrv ?? '—'}
            icon={<Heart className="w-4 h-4" />}
            unit={hrvBaseline ? `Baseline: ${hrvBaseline}` : undefined}
          />
          <MetricCard
            label="FC Repouso"
            value={latestCheck?.resting_hr ?? '—'}
            icon={<Activity className="w-4 h-4" />}
            unit="bpm"
          />
          <MetricCard
            label="TSS Semanal"
            value={Math.round(weeklyTSS)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Sono"
            value={latestCheck?.sleep_hours ? `${Number(latestCheck.sleep_hours).toFixed(1)}h` : '—'}
            icon={<Moon className="w-4 h-4" />}
            unit={latestCheck?.sleep_quality ? `Qualidade: ${latestCheck.sleep_quality}/5` : undefined}
          />
        </div>

        {/* Alerts */}
        {latestCheck && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hrvBaseline && latestCheck.hrv < hrvBaseline * 0.85 && (
                <Badge variant="destructive">
                  HRV em declínio ({Math.round(((latestCheck.hrv - hrvBaseline) / hrvBaseline) * 100)}%)
                </Badge>
              )}
              {latestCheck.sleep_hours && Number(latestCheck.sleep_hours) < 6 && (
                <Badge variant="destructive">
                  Privação de sono ({Number(latestCheck.sleep_hours).toFixed(1)}h)
                </Badge>
              )}
              {latestCheck.alcohol_yesterday && (
                <Badge variant="secondary">Consumo de álcool ontem</Badge>
              )}
              {!hrvBaseline ||
              (latestCheck.hrv >= hrvBaseline * 0.85 &&
                Number(latestCheck.sleep_hours || 8) >= 6 &&
                !latestCheck.alcohol_yesterday) ? (
                <p className="text-sm text-muted-foreground">Sem alertas ativos ✅</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Training Plans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Treinos Planejados</CardTitle>
            <Button size="sm" onClick={() => navigate(`/coach/prescribe?athlete=${athleteId}`)}>
              Prescrever
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum treino prescrito ainda.</p>
            ) : (
              recentPlans.map((plan: TrainingPlan) => (
                <div key={plan.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {plan.date} — {plan.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.planned_duration_min}min
                      {plan.planned_zone ? ` • Z${plan.planned_zone}` : ''}
                      {plan.planned_tss ? ` • TSS ${plan.planned_tss}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={
                      plan.status === 'completed'
                        ? 'default'
                        : plan.status === 'skipped'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {plan.status === 'planned'
                      ? 'Planejado'
                      : plan.status === 'completed'
                      ? 'Concluído'
                      : 'Pulado'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Workouts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Treinos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workouts.slice(0, 5).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {w.date} — {w.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.duration_min}min • RPE {w.rpe} • TSS {Number(w.tss_final || w.tss_subjective)}
                  </p>
                </div>
              </div>
            ))}
            {workouts.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem treinos registrados recentemente.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
