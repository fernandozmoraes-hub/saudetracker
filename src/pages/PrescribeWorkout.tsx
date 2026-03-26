import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { useCoachAthletes } from '@/hooks/useCoachAthletes';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function PrescribeWorkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAthlete = searchParams.get('athlete') || '';
  const { user } = useAuth();
  const { createPlan } = useTrainingPlans();
  const { activeAthletes } = useCoachAthletes();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    athlete_id: preselectedAthlete,
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'endurance',
    planned_duration_min: '',
    planned_zone: '',
    planned_tss: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!user || !form.athlete_id || !form.date || !form.type) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setSaving(true);
    const success = await createPlan({
      coach_id: user.id,
      athlete_id: form.athlete_id,
      date: form.date,
      type: form.type,
      planned_duration_min: form.planned_duration_min ? Number(form.planned_duration_min) : null,
      planned_zone: form.planned_zone || null,
      planned_tss: form.planned_tss ? Number(form.planned_tss) : null,
      notes: form.notes || null,
      status: 'planned',
      workout_id: null,
    });

    if (success) {
      toast.success('Treino prescrito com sucesso!');
      navigate(-1);
    } else {
      toast.error('Erro ao prescrever treino.');
    }
    setSaving(false);
  };

  return (
    <PageContainer title="Prescrever Treino" subtitle="Criar plano de treino para atleta">
      <div className="space-y-4 max-w-md mx-auto pb-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes do Treino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Atleta *</Label>
              <Select value={form.athlete_id} onValueChange={(v) => setForm(f => ({ ...f, athlete_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar atleta" />
                </SelectTrigger>
                <SelectContent>
                  {activeAthletes.map((a) => (
                    <SelectItem key={a.athlete_id} value={a.athlete_id}>
                      {a.athlete_id.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="endurance">Endurance</SelectItem>
                  <SelectItem value="strength">Força</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="recovery">Recuperação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duração Planejada (min)</Label>
              <Input
                type="number"
                value={form.planned_duration_min}
                onChange={(e) => setForm(f => ({ ...f, planned_duration_min: e.target.value }))}
                placeholder="Ex: 60"
              />
            </div>

            <div>
              <Label>Zona Alvo</Label>
              <Select value={form.planned_zone} onValueChange={(v) => setForm(f => ({ ...f, planned_zone: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Zona 1</SelectItem>
                  <SelectItem value="2">Zona 2</SelectItem>
                  <SelectItem value="3">Zona 3</SelectItem>
                  <SelectItem value="4">Zona 4</SelectItem>
                  <SelectItem value="5">Zona 5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>TSS Estimado</Label>
              <Input
                type="number"
                value={form.planned_tss}
                onChange={(e) => setForm(f => ({ ...f, planned_tss: e.target.value }))}
                placeholder="Ex: 80"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Instruções, foco do treino, etc."
              />
            </div>

            <Button onClick={handleSubmit} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Prescrever Treino
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
