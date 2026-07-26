## Objetivo
Incluir dois novos tipos de exercício monitorados: **Ioga** e **Caminhada**.

## Comportamento definido
- **Caminhada**: sessão de endurance — permite distância, FC média e tempo por zonas; TSS por FC/zonas (mesma lógica de Corrida/Bike), com fallback para RPE.
- **Ioga**: sessão leve — TSS apenas por RPE × duração (categoria "legacy"), sem campos de distância/FC.

## Mudanças

### 1. Banco de dados (migração)
- Atualizar o check de `workouts.type` para aceitar também `Walk` e `Yoga` (mantendo `Run`, `Strength`, `Bike`, `Rest`).
- Nenhuma alteração em `session_type` (os valores existentes já cobrem os dois casos).

### 2. Tipos
- `src/types/health.ts`: `WorkoutType` passa a incluir `'Walk' | 'Yoga'`.

### 3. Cálculo de carga
- `src/lib/calculations.ts` → `getSessionType`: `Walk` retorna `endurance`; `Yoga` cai no padrão `legacy` (RPE).
- Nenhuma alteração nas fórmulas de TSS, CTL, ATL, TSB ou PMC.

### 4. Tela de registro (`src/pages/Workout.tsx`)
- Adicionar botões "Caminhada" (ícone Footprints) e "Ioga" (ícone de alongamento/PersonStanding) na lista de tipos.
- Estender as condições que hoje testam `Run || Bike` para incluir `Walk`, de modo que distância, FC e zonas apareçam na caminhada.
- Ioga mostra apenas duração + RPE.
- Seleção de tênis (equipamento) passa a valer para `Run` e `Walk`.

### 5. Exibição
- Rótulos e ícones dos novos tipos no histórico da própria página de treino, no calendário e no detalhe do treino, para que não apareçam sem nome.
- `StravaImportModal`: mapear atividades `Walk`/`Hike` do Strava para o tipo Caminhada e `Yoga` para Ioga.

### 6. Prescrição de treino (opcional, incluído)
- Acrescentar "Caminhada" e "Ioga" às opções de tipo em `PrescribeWorkout.tsx` para o coach poder prescrevê-los.

## Fora do escopo
Nenhuma mudança em Performance Coach, composição corporal, álcool ou nas fórmulas de carga.