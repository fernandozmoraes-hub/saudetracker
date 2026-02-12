

## Plano: Pagina de Composicao Corporal com Agente de Integridade Muscular

### Visao Geral

Criar um sistema completo de monitoramento de composicao corporal com:
- Nova tabela `body_composition` no banco de dados
- Nova pagina com registro, graficos longitudinais e analise de tendencias
- Novo edge function `muscle-integrity-agent` (agente independente)
- Cruzamento automatico com dados de treino existentes
- Sem alterar agente fisiologico (`ai-coach`) nem logica de CTL/ATL/TSB

---

### Parte 1: Banco de Dados

**1.1 Nova tabela `body_composition`**

| Coluna | Tipo | Nullable | Default | Descricao |
|--------|------|----------|---------|-----------|
| id | uuid | No | gen_random_uuid() | PK |
| user_id | uuid | No | - | Referencia ao usuario |
| date | date | No | - | Data da medicao |
| weight_kg | numeric | No | - | Peso corporal |
| muscle_mass_kg | numeric | No | - | Massa muscular |
| body_fat_pct | numeric | No | - | Percentual de gordura |
| data_source | text | No | 'manual' | 'manual' ou 'smart_scale' |
| notes | text | Yes | null | Observacoes |
| flagged_inconsistent | boolean | No | false | Marcacao manual de medicao inconsistente |
| created_at | timestamptz | No | now() | - |
| updated_at | timestamptz | No | now() | - |

- Constraint UNIQUE em (user_id, date) para evitar duplicatas
- RLS policies seguindo o padrao existente (SELECT, INSERT, UPDATE, DELETE por user_id)
- Trigger `update_updated_at_column` reutilizado

---

### Parte 2: Tipos e Hook

**2.1 Novos tipos em `src/types/health.ts`**

```typescript
export type DataSource = 'manual' | 'smart_scale';

export interface BodyCompositionEntry {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  muscleMassKg: number;
  bodyFatPct: number;
  dataSource: DataSource;
  notes?: string;
  flaggedInconsistent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MuscleIntegrityStatus = 'preserved' | 'declining' | 'at_risk';
```

**2.2 Novo hook `src/hooks/useBodyComposition.tsx`**

Funcoes:
- `entries: BodyCompositionEntry[]` - todas as entradas ordenadas por data
- `isLoading: boolean`
- `saveEntry(entry): Promise<boolean>` - upsert por (user_id, date)
- `deleteEntry(id): Promise<boolean>`
- `toggleInconsistent(id): Promise<boolean>` - marca/desmarca medicao inconsistente
- `getLatest(): BodyCompositionEntry | null` - medicao mais recente
- `getFilteredEntries(days): BodyCompositionEntry[]` - entradas dos ultimos N dias, excluindo flagged

**2.3 Funcoes de calculo em `src/lib/bodyCompositionCalcs.ts`**

```typescript
// Media movel 7 dias (excluindo flagged)
function movingAverage7d(entries, field, targetDate): number | null

// Tendencia 30 dias com regressao linear simples
function calculateTrend30d(entries, field): {
  absoluteChange: number;
  percentChange: number;
  slope: number; // inclinacao da regressao
}

// Status de integridade muscular
function getMuscleIntegrityStatus(trend30d): MuscleIntegrityStatus
// Regras:
// - 'preserved': variacao entre -1% e +1%
// - 'declining': queda entre 1% e 2%
// - 'at_risk': queda >2% OU tendencia negativa continua por 60 dias

// Indice de Integridade Muscular
function calculateMuscleIntegrityIndex(
  currentLeanMassRatio, trend30d, weeklyTrainingLoad
): number

// Correlacao com treino (para o agente)
function getTrainingCorrelation(workouts, days): {
  weeklyVolumeKm: number;
  strengthFrequency: number; // treinos de forca nos ultimos 30d
  avgIntensity: number; // RPE medio
}
```

---

### Parte 3: Pagina de Composicao Corporal

**3.1 Nova rota em `App.tsx`**

```typescript
<Route path="/body-composition" element={<ProtectedRoute><BodyComposition /></ProtectedRoute>} />
```

**3.2 Pagina `src/pages/BodyComposition.tsx`**

**Secao 1 - Resumo Atual (Topo)**

Cards com:
- Peso atual (kg) com media movel 7d
- Massa muscular atual (kg) com media movel 7d
- % Gordura atual com media movel 7d
- Status do Indice de Integridade Muscular (indicador colorido)
  - Verde: Integridade preservada
  - Amarelo: Tendencia de perda
  - Vermelho: Perda muscular relevante

**Secao 2 - Grafico Longitudinal**

Grafico com recharts (ja instalado):
- 3 linhas: Peso, Massa Muscular, % Gordura
- Eixo Y duplo (kg a esquerda, % a direita)
- Filtro de periodo: 30d / 90d / 180d
- Dados filtrados excluem medicoes marcadas como inconsistentes

**Secao 3 - Avaliacao do Agente**

Bloco textual com:
- Indicador de status (cor)
- Analise contextual gerada pelo MuscleIntegrityAgent
- Disclaimer: "Esta analise e baseada em tendencias e nao substitui avaliacao medica."

**Secao 4 - Registro de Nova Medicao**

Modal/Sheet com campos:
- Data (default: hoje)
- Peso (kg) - obrigatorio
- Massa muscular (kg) - obrigatorio
- % Gordura - obrigatorio
- Origem: manual / balanca smart
- Observacoes (opcional)

**Secao 5 - Historico**

Lista das medicoes recentes com opcao de:
- Marcar como inconsistente (toggle)
- Excluir

**3.3 Navegacao**

Adicionar link na pagina Settings (mesmo padrao do Equipamentos):
- Icone: Scale ou Activity
- Label: "Composicao Corporal"
- Link para /body-composition

Tambem adicionar na BottomNav como item contextual ou subsecao de Settings.

---

### Parte 4: Edge Function - MuscleIntegrityAgent

**4.1 Novo arquivo `supabase/functions/muscle-integrity-agent/index.ts`**

**Dados que o agente recebe (buscados do banco):**

| Fonte | Dados |
|-------|-------|
| `body_composition` | Ultimas 60+ medicoes (excluindo flagged) |
| `workouts` | Ultimos 30-60 dias de treinos |
| Calculado | Tendencia 30d, media movel, correlacoes |

**Fluxo:**

1. Autenticar usuario
2. Buscar medicoes de composicao corporal (ultimos 90 dias, excluindo flagged)
3. Buscar treinos dos ultimos 60 dias
4. Calcular tendencias e correlacoes no backend
5. Construir prompt enriquecido
6. Enviar para Lovable AI (google/gemini-2.5-flash)
7. Retornar analise estruturada

**System Prompt do MuscleIntegrityAgent:**

```text
Voce e o MuscleIntegrityAgent, responsavel por analisar tendencias de composicao corporal.

Voce NAO e um agente fisiologico. NAO analise HRV, CTL, ATL ou TSB.
Voce NAO diagnostica condicoes medicas.
Voce NAO prescreve dieta ou treino.

Seu papel:
- Analisar tendencias de peso, massa muscular e % gordura
- Correlacionar com carga e tipo de treino
- Identificar padroes de risco funcional
- Gerar comentarios tecnicos claros

Cenarios de correlacao:
- Volume alto + queda muscular = recuperacao insuficiente
- Sem treino de forca + queda muscular = falta de estimulo anabolico
- Volume estavel + perda muscular = possivel deficit energetico

Classificacao:
- Preservada: variacao muscular entre -1% e +1% em 30 dias
- Tendencia de perda: queda entre 1% e 2% em 30 dias
- Perda relevante: queda >2% ou tendencia negativa por 60+ dias

Regras de linguagem:
- NAO use "sarcopenia", "atrofia" ou outros termos diagnosticos
- NAO recomende compra de suplementos
- NAO prescreva dieta ou treino
- Use sempre "tendencia sugere", "padrao indica", "dados apontam"

Sempre finalize com:
"Avaliacao baseada em tendencias de composicao corporal. Nao substitui avaliacao clinica."
```

**Prompt do usuario construido com dados reais:**

```text
COMPOSICAO CORPORAL - MEDICOES RECENTES:
[ultimas 10-15 medicoes com data, peso, massa muscular, % gordura]

TENDENCIA 30 DIAS (MASSA MUSCULAR):
- Variacao absoluta: X kg
- Variacao percentual: X%
- Inclinacao da regressao: X kg/dia

MEDIAS MOVEIS 7 DIAS (ATUAIS):
- Peso: X kg
- Massa muscular: X kg
- % Gordura: X%

MASSA MAGRA RELATIVA: X (massa_muscular / peso)

CONTEXTO DE TREINO (30 DIAS):
- Volume semanal medio: X km
- Frequencia de treinos de forca: X sessoes
- RPE medio: X
- TSS semanal medio: X

STATUS ATUAL: [preserved/declining/at_risk]

Forneca sua analise estruturada.
```

**Estrutura da resposta esperada:**

O agente retorna texto livre estruturado com:
1. Status (Preservada / Tendencia de perda / Perda relevante)
2. Analise contextual
3. Correlacao com treino
4. Disclaimer

---

### Parte 5: Controle de Ruido

Implementado nas funcoes de calculo:

- Media movel 7 dias para suavizar flutuacoes diarias
- Medicoes marcadas como "inconsistente" sao excluidas de calculos e graficos
- Variacoes isoladas <0.5% sao ignoradas na classificacao de tendencia
- Tendencia usa regressao linear (nao ponto a ponto) para robustez

---

### Parte 6: Integracao com Outros Modulos

**Leitura (somente):**
- Tabela `workouts`: volume semanal, tipo, frequencia de forca, RPE
- Calculado via funcoes existentes

**NAO altera:**
- Agente fisiologico (`ai-coach`)
- Sistema de HRV
- Logica de CTL / ATL / TSB
- Agente de avaliacao de treino (`workout-evaluator`)

---

### Parte 7: Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migration SQL | Criar | Tabela body_composition + RLS + trigger |
| `src/types/health.ts` | Modificar | Adicionar tipos BodyCompositionEntry, DataSource, MuscleIntegrityStatus |
| `src/lib/bodyCompositionCalcs.ts` | Criar | Funcoes de calculo (media movel, tendencia, regressao, correlacao) |
| `src/hooks/useBodyComposition.tsx` | Criar | Hook para CRUD e calculos derivados |
| `src/pages/BodyComposition.tsx` | Criar | Pagina principal com resumo, graficos e agente |
| `src/App.tsx` | Modificar | Adicionar rota /body-composition |
| `src/pages/Settings.tsx` | Modificar | Adicionar link para Composicao Corporal |
| `supabase/functions/muscle-integrity-agent/index.ts` | Criar | Novo edge function do agente |
| `supabase/config.toml` | Nao modificar | Atualizado automaticamente |

---

### Detalhes Tecnicos

**Regressao linear simples (slope):**

```typescript
function linearRegression(points: {x: number, y: number}[]): { slope: number, intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}
```

**Grafico com Recharts:**

Usa `LineChart` com `YAxis` duplo:
- yAxisId="left" para kg (peso + massa muscular)
- yAxisId="right" para % (gordura)
- `ResponsiveContainer` para responsividade mobile

---

### Nao Sera Alterado

- Agente fisiologico (`ai-coach`) - intacto
- Agente de avaliacao de treino (`workout-evaluator`) - intacto
- Logica de CTL / ATL / TSB em `calculations.ts` - intacto
- Sistema de HRV - intacto
- Pagina Today - intacto

