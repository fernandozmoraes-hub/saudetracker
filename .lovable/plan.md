

## Plano: Correlacao Alcool x HRV e Alertas Inteligentes

### Visao Geral

Expandir o modulo de alcool com correlacao estatistica (Pearson) entre consumo e variacao de HRV, deteccao de padroes semanais, alertas inteligentes e integracao ao Dashboard e Agente Fisiologico. Todos os calculos sao frontend-only usando dados ja disponiveis (alcohol_intake + daily_checks). Nenhuma alteracao no banco de dados.

---

### Parte 1: Funcoes de Correlacao em `src/lib/alcoholCalcs.ts`

Adicionar funcoes:

- **`calculateDeltaHRV(hrv, baseline)`** — `((hrv - baseline) / baseline) * 100`
- **`calculatePearsonCorrelation(pairs: {x, y}[])`** — coeficiente r padrao
- **`getAlcoholHRVCorrelation(alcoholEntries, dailyChecks)`** — janela movel 30 dias, correlaciona carga do dia N com ΔHRV do dia N+1. Retorna `{ r, classification, sampleSize, pairs }`. So calcula se >= 10 eventos com consumo > 0g
- **`classifyCorrelation(r)`** — retorna string:
  - |r| < 0.2: "Sem correlacao relevante"
  - -0.2 a -0.4: "Correlacao negativa leve"
  - -0.4 a -0.6: "Correlacao negativa moderada"
  - < -0.6: "Correlacao negativa forte"
- **`getWeeklyPattern(entries)`** — analisa ultimas 4 semanas. Retorna `{ pattern, weeklyTotals, avgWeekly, daysWithConsumption, trend }`:
  - "Padrao de Risco": >=60g/semana OU >=5 dias consumo
  - "Padrao Elevado": >=3 dias/semana OU media >40g OU crescimento >20% em 3 semanas
  - "Controlado": demais
- **`getPerformanceAlert(correlation, weeklyAvg, deltaHRVEvents)`** — retorna string de alerta ou null:
  - Correlacao moderada/forte + media >30g: "Possivel impacto consistente na recuperacao autonomica."
  - Correlacao forte + quedas >10% em multiplos eventos: "Padrao fisiologico consistente de impacto na recuperacao."

---

### Parte 2: Pagina AlcoholIntake.tsx — Nova Secao de Correlacao

Adicionar entre o Resumo Semanal e o Formulario:

**Card "Impacto do Alcool na Recuperacao"** com:
- Correlacao (r) com 2 casas decimais
- Classificacao textual com cor (verde/amarelo/vermelho)
- Tamanho da amostra (N eventos)
- Media semanal atual
- Tendencia das ultimas 4 semanas (seta ↑ ↓ →)
- Padrao de Consumo (badge: Controlado / Padrao Elevado / Padrao de Risco)
- Alerta de Performance (se aplicavel, box destacado)
- Mensagem "Dados insuficientes" se < 10 eventos

---

### Parte 3: Dashboard (Today.tsx) — Card de Alcool

Adicionar novo card **apos o AI Coach e antes dos Trend Charts**:

**Card "🍷 Impacto do Alcool"** (compacto):
- Correlacao (r) + classificacao
- Media semanal + tendencia
- Cores automaticas: verde (sem correlacao), amarelo (leve/moderada), vermelho (forte)
- So exibe se houver dados suficientes (>= 10 eventos)
- Usa `useAlcoholIntake` + `useData` para calcular

---

### Parte 4: Integracao com Agente Fisiologico

**`src/lib/triggers.ts`** — Expandir `AnalysisData.alcoholContext`:
```typescript
alcoholContext?: {
  yesterdayGrams: number;
  impact: string;
  consecutiveDrinkingDays: number;
  // NOVOS:
  correlationR?: number;
  correlationClassification?: string;
  weeklyAvgGrams?: number;
  weeklyPattern?: string;
  weeklyTrend?: string;
}
```

**`src/lib/analysisData.ts`** — Calcular e adicionar os novos campos ao `alcoholContext`

**`src/components/AICoach.tsx`** — Sem alteracao (ja passa `alcoholEntries` para `buildAnalysisData`)

**`supabase/functions/ai-coach/index.ts`**:
- Expandir `AlcoholContextSchema` com campos opcionais: `correlationR`, `correlationClassification`, `weeklyAvgGrams`, `weeklyPattern`, `weeklyTrend`
- Expandir secao "CONTEXTO DE ALCOOL" no user prompt com os novos dados
- System prompt ja cobre alcool — nenhuma alteracao

---

### Parte 5: Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/lib/alcoholCalcs.ts` | Adicionar funcoes de correlacao, padrao semanal e alertas |
| `src/pages/AlcoholIntake.tsx` | Adicionar card de correlacao e alertas |
| `src/pages/Today.tsx` | Adicionar card compacto de impacto do alcool |
| `src/lib/triggers.ts` | Expandir tipo alcoholContext |
| `src/lib/analysisData.ts` | Calcular e popular novos campos |
| `supabase/functions/ai-coach/index.ts` | Aceitar novos campos no schema e prompt |

### Nao Sera Alterado
- CTL/ATL/TSB/TSS
- Banco de dados (tudo calculado no frontend)
- System prompt do ai-coach
- Workout evaluator / Muscle integrity agent

