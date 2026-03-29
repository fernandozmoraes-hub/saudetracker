

## Plano: Implementar Calendário Semanal de Treinos para Coach

### Situação

Os arquivos descritos pelo usuário não estão no projeto. Precisam ser criados/modificados diretamente.

### Arquivos a criar

**1. `src/components/coach/CoachCalendarDay.tsx`**

Componente que exibe um dia no calendário do coach com:
- Treino planejado (da tabela `training_plans`): tipo, duração, zona, TSS, notas
- Status visual com cores: Concluído (verde), Planejado (azul), Não feito (laranja), Pulado (vermelho)
- Treino realizado (da tabela `workouts`): TSS real, duração, RPE
- Badge "Extra" quando há treino sem plano correspondente

**2. `src/pages/CoachAthleteCalendar.tsx`**

Página de calendário semanal com:
- Navegação por semanas (anterior/próxima/hoje) usando `subWeeks`/`addWeeks`
- Resumo semanal: contagem de planejados, concluídos, pulados, extras + barra TSS planejado vs realizado
- Grid de 7 dias usando `eachDayOfInterval(startOfWeek, endOfWeek)` com locale `ptBR`
- Dados via `useTrainingPlans(athleteId)` + fetch de workouts do atleta
- Reutiliza `PageContainer` para layout

### Arquivos a modificar

**3. `src/App.tsx`**
- Import `CoachAthleteCalendar`
- Adicionar rota: `<Route path="/coach/athlete/:id/calendar" element={<ProtectedRoute requiredRole="coach"><CoachAthleteCalendar /></ProtectedRoute>} />`

**4. `src/pages/CoachAthleteProfile.tsx`**
- Adicionar botão "Calendário" ao lado do botão "Voltar" que navega para `/coach/athlete/${athleteId}/calendar`

### Dependências utilizadas (já disponíveis)
- `date-fns`: `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `addWeeks`, `subWeeks`, `format`, `isToday`
- `date-fns/locale/ptBR`
- `useTrainingPlans` hook existente
- `supabase` client para fetch de workouts

### Sem alterações no banco de dados

