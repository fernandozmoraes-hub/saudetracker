import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { useCoachAthletes } from '@/hooks/useCoachAthletes';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, BookmarkPlus, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  endurance: 'Endurance',
  strength: 'Força',
  hiit: 'HIIT',
  recovery: 'Recuperação',
};

const TYPE_COLORS: Record<string, string> = {
  endurance: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  strength: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  hiit: 'bg-red-500/10 text-red-400 border-red-500/20',
  recovery: 'bg-green-500/10 text-green-400 border-green-500/20',
};

interface FormState {
  athlete_id: string;
  date: string;
  type: string;
  planned_duration_min: string;
  planned_zone: string;
  planned_tss: string;
  notes: string;
}

export default function PrescribeWorkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAthlete = searchParams.get('athlete') || '';
  const { user } = useAuth();
  const { createPlan } = useTrainingPlans();
  const { activeAthletes } = useCoachAthletes();
  const { templates, isLoading: templatesLoading, createTemplate, deleteTemplate } = useWorkoutTemplates();

  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    athlete_id: preselectedAthlete,
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'endurance',
    planned_duration_min: '',
    planned_zone: '',
    planned_tss: '',
    notes: '',
  });

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setForm((f) => ({
      ...f,
      type: tpl.type,
      planned_duration_min: tpl.planned_duration_min?.toString() ?? '',
      planned_zone: tpl.planned_zone ?? '',
      planned_tss: tpl.planned_tss?.toString() ?? '',
      notes: tpl.notes ?? '',
    }));
    toast.success(`Template "${tpl.name}" aplicado.`);
  };

  const handleSubmit = async () => {
    if (!user || !form.athlete_id || !form.date || !form.type) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    setSaving(true);
    const err = await createPlan({
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
    setSaving(false);
    if (err) { toast.error(err); return; }
    toast.success('Treino prescrito com sucesso!');
    navigate(-1);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { toast.error('Dê um nome ao template.'); return; }
    setSavingTemplate(true);
    const err = await createTemplate({
      name: templateName.trim(),
      type: form.type,
      planned_duration_min: form.planned_duration_min ? Number(form.planned_duration_min) : null,
      planned_zone: form.planned_zone || null,
      planned_tss: form.planned_tss ? Number(form.planned_tss) : null,
      notes: form.notes || null,
    });
    setSavingTemplate(false);
    if (err) { toast.error(err); return; }
    toast.success(`Template "${templateName.trim()}" salvo!`);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    const err = await deleteTemplate(id);
    if (err) toast.error(err);
    else {
      toast.success(`Template "${name}" removido.`);
      if (selectedTemplateId === id) setSelectedTemplateId(null);
    }
  };

  const getAthleteLabel = (athleteId: string) => {
    const a = activeAthletes.find((a) => a.athlete_id === athleteId);
    if (!a) return athleteId.slice(0, 8) + '...';
    return a.athlete_name ?? a.athlete_email ?? athleteId.slice(0, 8) + '...';
  };

  return (
    <PageContainer title="Prescrever Treino" subtitle="Criar plano de treino para atleta">
      <div className="space-y-4 max-w-md mx-auto pb-20">

        {/* Templates salvos */}
        {!templatesLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Templates Salvos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template ainda. Preencha o formulário e salve como template para reutilizar.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={cn(
                        'flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedTemplateId === tpl.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 bg-muted/30',
                      )}
                      onClick={() => applyTemplate(tpl.id)}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border font-medium',
                              TYPE_COLORS[tpl.type] ?? TYPE_COLORS.endurance,
                            )}
                          >
                            {TYPE_LABELS[tpl.type] ?? tpl.type}
                          </span>
                          {tpl.planned_duration_min && (
                            <span className="text-xs text-muted-foreground">{tpl.planned_duration_min}min</span>
                          )}
                          {tpl.planned_zone && (
                            <span className="text-xs text-muted-foreground">Z{tpl.planned_zone}</span>
                          )}
                          {tpl.planned_tss && (
                            <span className="text-xs text-muted-foreground">TSS {tpl.planned_tss}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id, tpl.name); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes do Treino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Atleta *</Label>
              <Select
                value={form.athlete_id}
                onValueChange={(v) => setForm((f) => ({ ...f, athlete_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar atleta">
                    {form.athlete_id ? getAthleteLabel(form.athlete_id) : 'Selecionar atleta'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeAthletes.map((a) => (
                    <SelectItem key={a.athlete_id} value={a.athlete_id}>
                      {a.athlete_name ?? a.athlete_email ?? a.athlete_id.slice(0, 8) + '...'}
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
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                onChange={(e) => setForm((f) => ({ ...f, planned_duration_min: e.target.value }))}
                placeholder="Ex: 60"
              />
            </div>

            <div>
              <Label>Zona Alvo</Label>
              <Select
                value={form.planned_zone}
                onValueChange={(v) => setForm((f) => ({ ...f, planned_zone: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
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
                onChange={(e) => setForm((f) => ({ ...f, planned_tss: e.target.value }))}
                placeholder="Ex: 80"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Instruções, foco do treino, etc."
              />
            </div>

            <Button onClick={handleSubmit} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Prescrever Treino
            </Button>
          </CardContent>
        </Card>

        {/* Salvar como template */}
        <Card>
          <CardContent className="pt-4">
            {!showSaveTemplate ? (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowSaveTemplate(true)}
              >
                <BookmarkPlus className="w-4 h-4" />
                Salvar como Template
              </Button>
            ) : (
              <div className="space-y-3">
                <Label>Nome do Template</Label>
                <Input
                  placeholder='Ex: Long Run Z2 - 90min'
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                  >
                    {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Salvar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </PageContainer>
  );
}
