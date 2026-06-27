## Tarefa
Adicionar faixas visuais de status no card "PMC — CTL / ATL / TSB" em `src/components/TrendCharts.tsx`, sem alterar cálculos, hooks, banco, Performance Coach ou demais gráficos.

## Contexto
O card PMC unificado já possui `ReferenceArea` para zonas TSB:
- Verde: TSB > 0
- Amarela: TSB entre 0 e -15
- Vermelha: TSB < -15

A alteração consiste em:
1. Ajustar a opacidade das faixas existentes para melhor legibilidade (mantendo-as sutis).
2. Adicionar uma legenda discreta abaixo do gráfico com:
   - 🟢 Recuperado: TSB > 0
   - 🟡 Construção: TSB entre 0 e -15
   - 🔴 Sobrecarga: TSB < -15

## Escopo
- Arquivo único: `src/components/TrendCharts.tsx`
- Componente afetado: card PMC (linhas ~287–393)
- Não alterar: HRV, CTL/ATL separado, TSB separado, cálculos, hooks, banco, Performance Coach, seletor de período, downsampling

## Implementação

### Ajuste visual das faixas
- Revisar os `fillOpacity` dos três `ReferenceArea` do TSB no `ComposedChart` do PMC.
- Aumentar levemente a opacidade para garantir que as zonas sejam perceptíveis sem prejudicar a leitura das linhas CTL/ATL.
- Usar cores dos tokens de status existentes (`status-ok`, `status-alert`, `status-critical`) via HSL para manter consistência com tema.

### Legenda discreta
- Inserir abaixo do gráfico, logo após a legenda existente CTL/ATL/TSB.
- Layout: linha flexível, centralizada, gap-4, texto `text-xs text-muted-foreground`.
- Cada item com um pequeno círculo colorido (w-2 h-2 rounded-full) e o rótulo correspondente.

### Checklist
- [ ] Faixas visuais ajustadas no PMC (apenas).
- [ ] Legenda de status TSB adicionada abaixo do gráfico PMC.
- [ ] Tooltip, legenda CTL/ATL/TSB, dois eixos Y, seletor de período e downsampling mantidos.
- [ ] Nenhum cálculo ou dado alterado.