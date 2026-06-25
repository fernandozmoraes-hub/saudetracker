## Relatório Semanal Inteligente — Performance Coach

Geração sob demanda (clique), JWT obrigatório, sem salvar em erro/timeout, blocos sem dados aparecem como "Dados insuficientes para análise."

### 1. Banco
Migração já executada: `performance_coach_history` ganhou `entry_type` (chat | weekly_report, default 'chat'), `report_period_start`, `report_period_end` + índice por `(user_id, entry_type, created_at)`.

### 2. `src/lib/weeklyPerformanceContext.ts` (novo)
`buildWeeklyPerformanceContext({ dailyChecks, workouts, alcoholEntries, bodyComposition, equipment, referenceDate })` — janela de 7 dias. Blocos:
- **recovery**: avgHrv, baseline 7d anterior, hrvVsBaselinePct, FC repouso, Body Battery, sono (h e qualidade), flags.
- **load**: TSS semanal, nº treinos, volume total (min/km), CTL/ATL/TSB inicial→final (reaproveita `calculateCTL/ATL`).
- **workouts**: força x endurance, duração total, RPE médio, top 5 destaques por TSS.
- **alcohol**: total g, dias com consumo, média semanal, correlação 30d (reusa `getAlcoholHRVCorrelation`).
- **bodyComposition**: última medição; tendência só com ≥2 medições em 30d e span ≥7 dias.
- **equipment**: tênis ativos, km, wear%, status, usado na semana?.

Cada bloco devolve `{ available: false, reason: 'no_data' | 'insufficient_data' }` quando não houver amostragem. `dataCoverage` mapeado por bloco.

### 3. `supabase/functions/weekly-performance-report/index.ts` (novo)
- JWT obrigatório (`getClaims`), zod no payload `{ weeklyContext, periodStart, periodEnd }`.
- Modelo `google/gemini-2.5-flash` via Lovable AI Gateway.
- System prompt obriga: usar só blocos `available: true`; bloco indisponível → escrever literalmente "Dados insuficientes para análise."; não prescrever treinos; não julgar álcool; não inventar números.
- Estrutura fixa: Resumo Executivo · Recuperação · Carga · Composição · Álcool · Equipamentos · Insights (3–5) · Pontos de Atenção (omitir se vazio) · Conclusão.
- Erros 401/400/429/402/5xx tratados; resposta `{ report, sectionsUsed, periodStart, periodEnd }`.

### 4. `src/lib/weeklyReportPdf.ts` (novo)
Helper jsPDF: título, período, corpo em parágrafos com cabeçalhos por emoji. Sem gráficos. Nome: `relatorio-semanal-YYYY-MM-DD.pdf`. Dependência `jspdf` já instalada.

### 5. `src/hooks/usePerformanceCoachHistory.tsx`
- Tipo recebe `entry_type`, `report_period_start/end`.
- `save()` aceita `entryType` e período opcionais; default permanece `'chat'`.

### 6. `src/pages/PerformanceCoach.tsx`
- Aba **Chat**: botão `📊 Gerar Relatório Semanal` acima das mensagens. Ao clicar:
  1. Monta contexto local.
  2. Invoca `weekly-performance-report`.
  3. Renderiza como mensagem assistant especial (badge "Relatório Semanal") + botão `📄 Exportar PDF`.
  4. Persiste no histórico com `entry_type='weekly_report'`, `intent_detected='weekly_report'`, tag `📊 Relatório Semanal`, período preenchido. Não salva em erro/timeout.
- Aba **Biblioteca**:
  - Filtro extra `📊 Relatórios` (filtra `entry_type='weekly_report'`).
  - Item de relatório usa ícone `BarChart3` e label "📊 Relatório Semanal".
  - Dialog de detalhe ganha botão `📄 Exportar PDF` reaproveitando o helper.

### 7. Garantias
- Zero chamadas automáticas — geração só ao clicar.
- JWT exigido na edge function.
- Erros/timeouts não criam linhas na Biblioteca.
- `dataCoverage` viaja com o contexto; blocos sem dados forçam o agente a escrever "Dados insuficientes para análise."
- Performance Coach (chat), ContextRouter, check-in, treinos, CTL/ATL/TSB/HRV e demais módulos intocados.
