## Plano: Performance Coach V2 — Roteador de Intenção + Biblioteca

Preserva `ai-coach`, Check-in, CTL/ATL/TSB, cálculos, triggers, páginas existentes e `performanceContext.ts`.

### 1. `src/lib/contextRouter.ts` (novo)
- `routePerformanceQuestion(question)` → `{ intent, label, tag, requiredSections, optionalSections }`.
- Intents: `recovery`, `training_load`, `body_composition`, `alcohol_impact`, `equipment`, `progress`, `general` (mapeamento de keywords PT-BR conforme especificação).
- `filterPerformanceContext(ctx, required, optional)`: mantém apenas seções relevantes, marca as demais como `{ available: false, reason: 'not_relevant' }` e atualiza `dataCoverage`. Mantém prompt enxuto.
- Exporta `INTENT_LABELS`, `INTENT_TAGS`, `SECTION_LABELS`.

### 2. `supabase/functions/performance-coach/index.ts` (editar)
- Aceitar `intent` e `sectionsUsed` opcionais no body (Zod).
- System prompt revisado: usar apenas seções `available:true`; ignorar seções `reason:'not_relevant'`; declarar "Dados insuficientes" para `insufficient_data`/`no_data`; nunca prescrever treino.
- Resposta inclui `{ answer, intent, sectionsUsed }`.

### 3. Tabela `performance_coach_history` (migration — já aplicada)
Campos: `question`, `answer`, `intent_detected`, `data_sections_used[]`, `tags[]`, `favorite`. RLS por `auth.uid()`.

### 4. `src/hooks/usePerformanceCoachHistory.tsx` (novo)
- `entries`, `isLoading`, `save()`, `toggleFavorite()`, `remove()`, `refresh()`.

### 5. `src/pages/PerformanceCoach.tsx` (editar)
- `Tabs` shadcn: **Chat** e **Biblioteca**.
- **Chat**: para cada pergunta → roteia intenção → filtra contexto → invoca edge function com `intent`/`sectionsUsed` → renderiza resposta + rodapé discreto "Dados utilizados: ✓ X ✓ Y". Persiste no histórico **apenas após resposta bem-sucedida** (não salva em erro/timeout).
- **Biblioteca**: busca por pergunta/resposta; chips de filtro (Recuperação, Carga, Composição, Álcool, Equipamentos, Evolução, Geral, Favoritos); lista com pergunta + 1ª linha da resposta + data + badge de intent + ícone favorito; Dialog ao abrir item (pergunta, resposta completa, data, intenção, seções utilizadas); ações favoritar/excluir.

### Garantias
- Erro/timeout: não persiste no histórico.
- Contexto enviado: apenas seções relevantes + `dataCoverage` indicando demais como `not_relevant` (sem blocos vazios).
- Cada usuário só acessa o próprio histórico (RLS).
