

## Plano: Implementar Pagina de Equipamentos (Tenis) com Integracao ao Workout Evaluator

### Visao Geral

Criar um sistema completo de gerenciamento de tenis de corrida, com:
- Nova tabela `equipment` no banco de dados
- Adicao de campo `equipment_id` na tabela `workouts`
- Nova pagina de Equipamentos com UI/UX consistente
- Acumulacao automatica de quilometragem
- Alertas automaticos de desgaste
- Integracao com o Workout Evaluator Agent

### Arquitetura Proposta

```text
+-------------------+       +-------------------+
|     workouts      |       |     equipment     |
+-------------------+       +-------------------+
| id                |       | id                |
| ...               |       | user_id           |
| equipment_id  ----+-----> | name              |
| distance_km       |       | brand             |
+-------------------+       | start_date        |
                            | total_km          |
                            | max_km            |
                            | status            |
                            | active            |
                            +-------------------+
```

---

### Parte 1: Banco de Dados

**1.1 Nova tabela `equipment`**

| Coluna | Tipo | Nullable | Default | Descricao |
|--------|------|----------|---------|-----------|
| id | uuid | No | gen_random_uuid() | PK |
| user_id | uuid | No | - | FK para auth.users |
| name | text | No | - | Nome do tenis |
| brand | text | Yes | null | Marca |
| start_date | date | No | CURRENT_DATE | Data de inicio de uso |
| total_km | numeric | No | 0 | Km acumulados (auto-calculado) |
| max_km | numeric | No | 600 | Limite recomendado |
| status | text | No | 'active' | 'active', 'attention', 'retired' |
| active_for_selection | boolean | No | true | Aparece no dropdown |
| created_at | timestamptz | No | now() | - |
| updated_at | timestamptz | No | now() | - |

**1.2 Alterar tabela `workouts`**

Adicionar coluna:
- `equipment_id` (uuid, nullable, FK para equipment.id)

**1.3 RLS Policies para `equipment`**

Seguindo o padrao existente:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

**1.4 Database Trigger**

Criar trigger para atualizar `total_km` automaticamente quando um workout e salvo/atualizado/deletado com `equipment_id` e `distance_km`.

---

### Parte 2: Frontend - Tipos e Hooks

**2.1 Novos tipos em `src/types/health.ts`**

```typescript
export type EquipmentStatus = 'active' | 'attention' | 'retired';

export interface Equipment {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  startDate: string;
  totalKm: number;
  maxKm: number;
  status: EquipmentStatus;
  activeForSelection: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

**2.2 Atualizar tipo `Workout`**

Adicionar campo `equipmentId?: string`

**2.3 Novo hook `src/hooks/useEquipment.tsx`**

```typescript
// Funcoes:
// - equipment: Equipment[]
// - isLoading: boolean
// - saveEquipment(equipment: Equipment): Promise<boolean>
// - deleteEquipment(id: string): Promise<boolean>
// - refreshEquipment(): Promise<void>
// - getActiveEquipment(): Equipment[] (apenas active_for_selection = true)
```

---

### Parte 3: Frontend - Pagina de Equipamentos

**3.1 Nova rota em `App.tsx`**

```typescript
<Route path="/equipment" element={<ProtectedRoute><Equipment /></ProtectedRoute>} />
```

**3.2 Pagina `src/pages/Equipment.tsx`**

**Layout Principal (Lista de Tenis):**

Cada tenis como card contendo:
- Nome do tenis (destaque)
- Km acumulados / Km recomendados (ex: 420 / 600 km)
- Barra de progresso visual (% de desgaste)
- Status visual com cores:
  - Verde (active): ate 80%
  - Amarelo (attention): 80-100%
  - Vermelho (retired): >100%
- Botao "Ver detalhes"

**Modal/Sheet de Detalhes:**
- Dados gerais do tenis
- Km acumulados com barra de progresso
- Lista dos ultimos treinos associados
- Status atual (somente leitura)
- Botao para "Aposentar" manualmente
- Botao para editar nome/marca/limite

**Modal de Adicionar Novo Tenis:**
- Campo: Nome (obrigatorio)
- Campo: Marca (opcional)
- Campo: Data de inicio (default: hoje)
- Campo: Km maximo recomendado (default: 600)

**3.3 Navegacao**

Adicionar item na BottomNav (ou em Settings como subsecao):

Opcao 1 - Subsecao em Settings:
- Link para /equipment dentro da pagina Settings

Opcao 2 - Novo item na BottomNav:
- Icone: Footprints ou Package
- Label: "Tenis"

Recomendacao: Subsecao em Settings para nao poluir a navegacao principal.

---

### Parte 4: Integracao com Treinos

**4.1 Atualizar `src/pages/Workout.tsx`**

Para treinos do tipo "Run":
- Adicionar dropdown de selecao de tenis
- Mostrar apenas tenis com `active_for_selection = true`
- Campo obrigatorio para corridas com distancia

**4.2 Atualizar `src/components/strava/StravaImportModal.tsx`**

- Adicionar step de selecao de tenis antes de confirmar importacao
- Mostrar lista de tenis ativos

**4.3 Atualizar `src/hooks/useData.tsx`**

- Incluir `equipment_id` no save/update de workouts
- Mapeamento correto do campo

---

### Parte 5: Logica de Alertas Automaticos

**5.1 Funcao de calculo de status**

```typescript
function calculateEquipmentStatus(totalKm: number, maxKm: number): EquipmentStatus {
  const percentage = (totalKm / maxKm) * 100;
  if (percentage >= 100) return 'retired';
  if (percentage >= 80) return 'attention';
  return 'active';
}
```

**5.2 Trigger no banco de dados**

Apos cada UPDATE em `equipment.total_km`:
- Recalcular status
- Se status = 'retired', setar `active_for_selection = false`

**5.3 Alertas visuais**

Na pagina de Equipamentos:
- Cards com borda colorida conforme status
- Badge de alerta para tenis em "attention"
- Card destacado para tenis "retired"

Na pagina Today/Index:
- Banner de alerta se houver tenis proximo do limite

---

### Parte 6: Integracao com Workout Evaluator Agent

**6.1 Atualizar `supabase/functions/workout-evaluator/index.ts`**

**Buscar dados do equipamento usado:**

```typescript
// Adicionar ao fetchHistoricalContext ou criar funcao separada
async function fetchEquipmentContext(
  supabase: SupabaseClient,
  userId: string,
  equipmentId: string
): Promise<EquipmentContext | null> {
  const { data } = await supabase
    .from('equipment')
    .select('name, brand, total_km, max_km, status, start_date')
    .eq('id', equipmentId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (!data) return null;
  
  const wearPercentage = (data.total_km / data.max_km) * 100;
  return {
    name: data.name,
    brand: data.brand,
    totalKm: data.total_km,
    maxKm: data.max_km,
    wearPercentage,
    status: data.status,
    daysInUse: calculateDaysInUse(data.start_date)
  };
}
```

**6.2 Atualizar `buildWorkoutPrompt`**

Adicionar secao de contexto do equipamento:

```typescript
if (context.equipment) {
  lines.push(`\nEQUIPAMENTO UTILIZADO:`);
  lines.push(`- Tenis: ${context.equipment.name}${context.equipment.brand ? ` (${context.equipment.brand})` : ''}`);
  lines.push(`- Km acumulados: ${context.equipment.totalKm.toFixed(0)} / ${context.equipment.maxKm} km (${context.equipment.wearPercentage.toFixed(0)}%)`);
  lines.push(`- Status: ${context.equipment.status}`);
  lines.push(`- Dias de uso: ${context.equipment.daysInUse}`);
}
```

**6.3 Atualizar SYSTEM_PROMPT**

Adicionar instrucoes sobre analise de equipamento:

```text
Ao avaliar treinos de corrida, considere o estado do equipamento (tenis):
- Se o desgaste estiver acima de 85%, mencione que a absorção de impacto pode estar comprometida
- Se o desgaste estiver acima de 100%, alerte sobre o risco aumentado de lesões
- Nunca recomende compra de equipamentos
- Apenas comente sobre o impacto potencial no desempenho e recuperação
```

**6.4 Exemplos de comentarios esperados**

- Desgaste alto (85%): "Este treino foi realizado com um tenis ja acima de 85% da vida util. Para treinos longos ou intensos, considere alternar com outro par para reduzir risco de lesao."

- Desgaste critico (>100%): "O tenis utilizado ultrapassou o limite recomendado de quilometragem. Isso pode comprometer absorcao de impacto e economia de corrida."

- Desgaste baixo (<50%): "O tenis utilizado esta em boas condicoes, sem impacto negativo esperado no desempenho ou recuperacao."

---

### Parte 7: Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/migrations/*.sql` | Criar | Tabela equipment, FK em workouts, trigger, RLS |
| `src/types/health.ts` | Modificar | Adicionar tipos Equipment e EquipmentStatus |
| `src/hooks/useEquipment.tsx` | Criar | Hook para CRUD de equipamentos |
| `src/hooks/useData.tsx` | Modificar | Incluir equipment_id no workout |
| `src/pages/Equipment.tsx` | Criar | Pagina principal de equipamentos |
| `src/pages/Workout.tsx` | Modificar | Adicionar selecao de tenis |
| `src/components/strava/StravaImportModal.tsx` | Modificar | Adicionar selecao de tenis |
| `src/components/layout/BottomNav.tsx` | Modificar | (Opcional) Adicionar link |
| `src/pages/Settings.tsx` | Modificar | Adicionar link para Equipamentos |
| `src/App.tsx` | Modificar | Adicionar rota /equipment |
| `supabase/functions/workout-evaluator/index.ts` | Modificar | Buscar e usar contexto do equipamento |

---

### Detalhes Tecnicos

**Calculo automatico de km:**

O trigger no banco de dados sera responsavel por:
1. Ao INSERT/UPDATE/DELETE em workouts com equipment_id
2. Recalcular SUM(distance_km) para aquele equipment_id
3. Atualizar total_km na tabela equipment
4. Recalcular status baseado no percentual
5. Se status = 'retired', setar active_for_selection = false

**SQL do Trigger:**

```sql
CREATE OR REPLACE FUNCTION update_equipment_km()
RETURNS TRIGGER AS $$
DECLARE
  v_total_km NUMERIC;
  v_max_km NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Determinar o equipment_id afetado
  IF TG_OP = 'DELETE' THEN
    IF OLD.equipment_id IS NULL THEN RETURN OLD; END IF;
    
    SELECT COALESCE(SUM(distance_km), 0) INTO v_total_km
    FROM workouts WHERE equipment_id = OLD.equipment_id;
    
    UPDATE equipment 
    SET total_km = v_total_km,
        status = CASE 
          WHEN v_total_km >= max_km THEN 'retired'
          WHEN v_total_km >= max_km * 0.8 THEN 'attention'
          ELSE 'active'
        END,
        active_for_selection = (v_total_km < max_km),
        updated_at = now()
    WHERE id = OLD.equipment_id;
    
    RETURN OLD;
  ELSE
    IF NEW.equipment_id IS NULL THEN RETURN NEW; END IF;
    
    SELECT COALESCE(SUM(distance_km), 0) INTO v_total_km
    FROM workouts WHERE equipment_id = NEW.equipment_id;
    
    SELECT max_km INTO v_max_km FROM equipment WHERE id = NEW.equipment_id;
    
    UPDATE equipment 
    SET total_km = v_total_km,
        status = CASE 
          WHEN v_total_km >= v_max_km THEN 'retired'
          WHEN v_total_km >= v_max_km * 0.8 THEN 'attention'
          ELSE 'active'
        END,
        active_for_selection = (v_total_km < v_max_km),
        updated_at = now()
    WHERE id = NEW.equipment_id;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_equipment_km
AFTER INSERT OR UPDATE OR DELETE ON workouts
FOR EACH ROW EXECUTE FUNCTION update_equipment_km();
```

---

### Nao Sera Alterado

Conforme especificado:
- Agente fisiologico (ai-coach)
- Logica de CTL / ATL / TSB
- Calculo de HRV e metricas fisiologicas
- Nenhuma mistura de equipamentos com analise fisiologica

---

### Proximos Passos Apos Implementacao

1. Adicionar suporte para outros tipos de equipamento (bike, sapatilha)
2. Historico de trocas de equipamento
3. Exportar relatorio de uso por equipamento
4. Grafico de evolucao de km por tenis ao longo do tempo

