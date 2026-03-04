

## Plano: Modulo de Controle de Consumo de Alcool

### Visao Geral

Criar modulo independente de monitoramento de consumo de alcool (cerveja e vinho) com calculo automatico de gramas, classificacao fisiologica, integracao com Check-in e Agente Fisiologico.

---

### Parte 1: Banco de Dados

**Tabela `alcohol_intake`**

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | - | Referencia ao usuario |
| date | date | - | Data do consumo |
| time | time | null | Horario (opcional) |
| drink_type | text | - | 'beer' ou 'wine' |
| volume_ml | numeric | - | Volume por dose (ml) |
| num_drinks | integer | 1 | Numero de doses |
| abv_percent | numeric | - | Teor alcoolico % |
| alcohol_grams | numeric | - | Calculado: vol * doses * (abv/100) * 0.789 |
| notes | text | null | Observacoes |
| created_at | timestamptz | now() | - |

- RLS policies padrao (SELECT/INSERT/UPDATE/DELETE por user_id)
- Sem constraint UNIQUE (multiplos registros por dia sao esperados)

**Coluna na tabela `daily_checks`**

Adicionar coluna `alcohol_yesterday` (boolean, default false) para o campo "Consumiu alcool nas ultimas 24h?"

---

### Parte 2: Tipos e Funcoes de Calculo

**Novos tipos em `src/types/health.ts`**

```typescript
export type DrinkType = 'beer' | 'wine';
export type AlcoholImpact = 'none' | 'light' | 'moderate' | 'high' | 'very_high';

export interface AlcoholIntakeEntry {
  id: string;
  userId: string;
  date: string;
  time?: string;
  drinkType: DrinkType;
  volumeMl: number;
  numDrinks: number;
  abvPercent: number;
  alcoholGrams: number;
  notes?: string;
}
```

**Novo arquivo `src/lib/alcoholCalcs.ts`**

Funcoes:
- `calculateAlcoholGrams(volumeMl, numDrinks, abvPercent)` — formula: vol * doses * (abv/100) * 0.789
- `getDefaultAbv(drinkType)` — beer: 5, wine: 12
- `getDailyTotal(entries, date)` — soma gramas do dia
- `getAlcoholImpact(grams)` — 0g: none, 1-20: light, 21-40: moderate, 41-60: high, >60: very_high
- `getImpactLabel(impact)` — labels em portugues
- `getWeeklyStats(entries)` — soma semanal, media diaria, dias consecutivos sem consumo
- `getAlcoholFlag(previousDayGrams)` — retorna flag para check-in do dia seguinte

---

### Parte 3: Hook `src/hooks/useAlcoholIntake.tsx`

- `entries: AlcoholIntakeEntry[]`
- `isLoading: boolean`
- `saveEntry(entry): Promise<boolean>` — insert com calculo automatico de alcohol_grams
- `deleteEntry(id): Promise<boolean>`
- `getDailyEntries(date): AlcoholIntakeEntry[]`
- `getDailyTotal(date): number` — gramas totais do dia
- `getYesterdayTotal(): number` — para flags

---

### Parte 4: Pagina `src/pages/AlcoholIntake.tsx`

**Secao 1 — Resumo Semanal (Dashboard)**

Card com:
- Total semanal (g) com cor automatica (verde <=20g media, amarelo 21-40g, vermelho >40g)
- Media diaria
- Dias consecutivos sem consumo
- Classificacao media da semana

**Secao 2 — Registro de Consumo**

Formulario com:
- Data (default: hoje)
- Horario (opcional)
- Tipo: Cerveja / Vinho (select com 2 opcoes)
- Volume por dose (ml) — placeholder: 350ml cerveja, 150ml vinho
- Numero de doses (default: 1)
- ABV% — preenchido automaticamente (5% ou 12%), editavel
- Gramas calculados (exibido em tempo real, nao editavel)
- Notas (opcional)

**Secao 3 — Historico**

Lista dos registros recentes agrupados por dia, mostrando:
- Tipo + quantidade
- Gramas totais do dia
- Classificacao fisiologica (badge colorido)
- Opcao de excluir

---

### Parte 5: Integracao com Check-in

**Pagina `src/pages/CheckIn.tsx`**

Adicionar campo toggle/switch:
- Label: "Consumiu alcool nas ultimas 24h?"
- Salva no campo `alcohol_yesterday` da tabela `daily_checks`

Exibir flag automatica se carga do dia anterior > 40g:
- Buscar registros de alcool do dia anterior
- Se > 40g: mostrar badge "⚠ Recuperacao Comprometida"
- Se > 60g: mostrar badge "🔴 Alto Impacto Fisiologico"

**Tipo `DailyCheck`**: adicionar campo `alcoholYesterday?: boolean`

**Hook `useData`**: mapear `alcohol_yesterday` no fetch e save de daily_checks

---

### Parte 6: Integracao com Agente Fisiologico

**Arquivo `src/lib/analysisData.ts`**

Adicionar ao `buildAnalysisData`:
- Buscar registros de alcool do dia anterior via Supabase
- Calcular carga alcoolica do dia anterior
- Calcular dias consecutivos com consumo
- Adicionar ao objeto `AnalysisData`

**Tipo `AnalysisData` em `src/lib/triggers.ts`**

Adicionar campo opcional:

```typescript
alcoholContext?: {
  yesterdayGrams: number;
  impact: string;
  consecutiveDrinkingDays: number;
}
```

**Edge function `ai-coach/index.ts`**

Atualizar:
- Schema de validacao para aceitar `alcoholContext` opcional
- User prompt: adicionar secao "CONTEXTO DE ALCOOL" com dados
- O system prompt ja menciona alcool — nenhuma alteracao necessaria no system prompt

---

### Parte 7: Navegacao

**`src/components/layout/BottomNav.tsx`**

A BottomNav ja tem 6 itens. A pagina de alcool sera acessivel via Settings (mesmo padrao de Equipamentos), nao na BottomNav para evitar sobrecarga.

**`src/pages/Settings.tsx`**

Adicionar link para `/alcohol-intake` com icone Wine.

**`src/App.tsx`**

Adicionar rota `/alcohol-intake` protegida.

---

### Parte 8: Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabela alcohol_intake + coluna alcohol_yesterday em daily_checks |
| `src/types/health.ts` | Adicionar tipos DrinkType, AlcoholImpact, AlcoholIntakeEntry; campo alcoholYesterday em DailyCheck |
| `src/lib/alcoholCalcs.ts` | Criar funcoes de calculo |
| `src/hooks/useAlcoholIntake.tsx` | Criar hook CRUD |
| `src/pages/AlcoholIntake.tsx` | Criar pagina |
| `src/pages/CheckIn.tsx` | Adicionar campo alcohol_yesterday + flag de impacto |
| `src/hooks/useData.tsx` | Mapear alcohol_yesterday no fetch/save |
| `src/lib/analysisData.ts` | Adicionar contexto de alcool |
| `src/lib/triggers.ts` | Adicionar alcoholContext ao tipo AnalysisData |
| `supabase/functions/ai-coach/index.ts` | Aceitar e usar alcoholContext no prompt |
| `src/App.tsx` | Adicionar rota |
| `src/pages/Settings.tsx` | Adicionar link |

### Nao Sera Alterado

- System prompt do ai-coach (ja cobre alcool)
- Logica de CTL/ATL/TSB
- Workout evaluator
- Muscle integrity agent
- Pagina Today (nenhum card de alcool no dashboard principal por enquanto)

