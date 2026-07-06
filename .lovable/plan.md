## Objetivo
Eliminar exibições com precisão excessiva (ex.: `3.199999999999999`) padronizando formatação numérica via helper compartilhado.

## Causa raiz
No `WeeklySummary.tsx` (Calendário), TSB é calculado inline como `ctl - atl` e renderizado direto (`{tsb}`), sem `toFixed`. CTL/ATL vêm de `calculations.ts` já arredondados para 1 casa, mas a subtração reintroduz o erro de ponto flutuante.

## Mudanças

### 1. Criar helper compartilhado
Novo arquivo `src/lib/formatMetric.ts`:
```ts
export function formatMetric(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "0.0";
  return Number(value).toFixed(decimals);
}
```

### 2. Corrigir Calendário (bug reportado)
`src/components/calendar/WeeklySummary.tsx`:
- Importar `formatMetric`.
- Exibir CTL, ATL e TSB com `formatMetric(...)` (1 casa).
- Manter lógica de status TSB (`getTsbStatus`) e ícone de tendência inalterados.

### 3. Varredura e padronização (escopo controlado)
Aplicar `formatMetric` apenas onde há risco real de float drift ou inconsistência de casas decimais nos indicadores de carga/recuperação:

- `src/pages/Today.tsx` — cards CTL/ATL/TSB (já usam `toFixed(1)`, trocar por `formatMetric` para consistência).
- `src/components/ui/LoadStatusCard.tsx` — valor TSB exibido.
- `src/components/TrendCharts.tsx` — tooltips/labels de CTL/ATL/TSB no PMC.
- `src/components/calendar/DayMetricsCard.tsx` — se exibir HRV/métricas derivadas.

### 4. Fora de escopo
- Não alterar fórmulas (`calculateATL`, `calculateCTL`, TSS).
- Não tocar em distância (`toFixed(1)` já consistente), duração (inteiros), Performance Coach, banco, edge functions, gráficos (eixos), ou PDFs.
- TSS continua exibido como inteiro (`Math.round`), conforme padrão atual.

## Validação
- Abrir `/calendar` em semana com CTL=11.2 / ATL=8.0 → TSB deve mostrar `3.2`.
- `bun run build` + `tsgo` limpos.
- Screenshot Playwright do card "Resumo da Semana" confirmando os 3 valores com 1 casa decimal.
