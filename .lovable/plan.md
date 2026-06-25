## Plano: Página "Performance Coach" (final, com fallback anti-alucinação)

### Arquivos a criar
- **`src/lib/performanceContext.ts`** — `buildPerformanceContext({ dailyChecks, workouts, alcoholEntries, bodyComposition, equipment })` retornando objeto com 6 seções (`today`, `last7Days`, `last30Days`, `bodyComposition`, `recentWorkouts`, `equipment`) + `alcoholCorrelation` + `dataCoverage`. Apenas agrega cálculos existentes (`lib/calculations.ts`, `lib/bodyCompositionCalcs.ts`, `lib/alcoholCalcs.ts`).
- **`supabase/functions/performance-coach/index.ts`** — nova edge function, CORS + Zod, `LOVABLE_API_KEY`, modelo `google/gemini-2.5-flash`. System prompt reforça regra anti-alucinação. Trata 429/402.
- **`src/pages/PerformanceCoach.tsx`** — chat coerente com tokens do app, chips de sugestões, aviso de cobertura limitada, histórico em memória.

### Arquivos a editar (mínimo)
- **`src/App.tsx`** — `import PerformanceCoach` e rota `<Route path="/performance-coach" element={<ProtectedRoute><PerformanceCoach /></ProtectedRoute>} />`.
- **`src/pages/Today.tsx`** — adicionar card "Performance Coach" com botão "Abrir Performance Coach" → `/performance-coach`, mantendo o padrão visual.

### Fallback seguro (anti-alucinação)
- Cada seção retorna `{ available: false, reason: 'no_data' | 'insufficient_data', requiredDays?, foundDays? }` quando faltar amostragem mínima:
  - `today`: requer check-in do dia.
  - `last7Days`: requer ≥3 dias com check-in.
  - `last30Days`: `hrvTrend` e `sleepTrend` só preenchidos com ≥10 pontos; `alcoholTrend` só com ≥3 semanas com dados.
  - `bodyComposition`: trend 30d só com ≥2 medições e span ≥14 dias.
  - `recentWorkouts` / `equipment`: arrays vazios quando não houver registros.
- Campo top-level `dataCoverage` enumera seções `available` / `unavailable`.
- System prompt instrui o agente a declarar "dados insuficientes" e nunca inferir tendência quando o campo for `null` ou `available: false`.

### Não muda
- `BottomNav.tsx`, `ai-coach`, `AICoach.tsx`, triggers, cálculos, tabelas, RLS, demais páginas.

### Considerações
- Sem migration, sem novos secrets (`LOVABLE_API_KEY` já existe).
- Histórico apenas em sessão; sem persistência.
