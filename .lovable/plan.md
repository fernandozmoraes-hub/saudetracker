

## Plano: Implementar Compliance / Adesão ao Plano para Coach

### Situação

Os arquivos `useCoachCompliance.tsx` e `ComplianceBadge.tsx` não existem no projeto. O `CoachDashboard.tsx` e `CoachAthleteProfile.tsx` não contêm referências a compliance. Precisam ser criados e integrados.

### Arquivos a criar

**1. `src/hooks/useCoachCompliance.tsx`**

- `computeCompliance(plans: TrainingPlan[])`: função pura que retorna `{ total, completed, skipped, missed, rate, consecutiveMissed }`
  - `completed`: planos com `status === 'completed'`
  - `skipped`: planos com `status === 'skipped'`
  - `missed`: planos com `status === 'planned'` e data no passado
  - `rate`: `completed / total * 100`
  - `consecutiveMissed`: contagem de treinos ignorados/pulados consecutivos a partir do mais recente
- `useCoachCompliance()`: hook que busca `training_plans` dos últimos 30 dias via query com `coach_id = user.id`, agrupa por `athlete_id`, aplica `computeCompliance` para cada atleta, retorna `Map<athleteId, ComplianceStats>`

**2. `src/components/coach/ComplianceBadge.tsx`**

Duas variantes via prop `variant`:
- **`compact`**: badge colorido mostrando "X/Y este mês" + ícone `AlertTriangle` laranja se `consecutiveMissed >= 3`
- **`full`**: card com taxa %, barra `Progress`, breakdown em 3 colunas (Concluídos/Pulados/Não feitos), alerta de abandono

Cores: verde (≥80%), amarelo (≥50%), vermelho (<50%)

### Arquivos a modificar

**3. `src/pages/CoachDashboard.tsx`**
- Importar `useCoachCompliance` e `ComplianceBadge`
- Chamar `useCoachCompliance()` no componente
- No card de cada atleta ativo, adicionar `<ComplianceBadge variant="compact" stats={complianceMap.get(athlete.athlete_id)} />` ao lado do badge "Ativo"

**4. `src/pages/CoachAthleteProfile.tsx`**
- Importar `computeCompliance` e `ComplianceBadge`
- Calcular compliance a partir dos `plans` já disponíveis via `useTrainingPlans`
- Adicionar `<ComplianceBadge variant="full" stats={stats} />` como card entre os Alertas e Treinos Planejados

### Sem alterações no banco de dados

