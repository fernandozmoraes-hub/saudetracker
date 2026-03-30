

## Plano: Corrigir validação do AI Coach Edge Function

### Diagnóstico

Os logs mostram repetidamente: `fieldErrors: { analysisData: [ "Number must be greater than or equal to 20" ] }`. O campo `restingHr` no `TodayDataSchema` exige `.min(20)`, mas o valor enviado está abaixo de 20 (provavelmente 0 quando não preenchido).

### Correção

**Arquivo: `supabase/functions/ai-coach/index.ts`**

Alterar o `TodayDataSchema` para aceitar `restingHr` a partir de 0:

```typescript
restingHr: z.number().min(0).max(250),
```

Isso permite que o sistema funcione mesmo quando o usuário não preencheu a FC de repouso (valor 0), sem quebrar a validação. O valor 0 será tratado como "não informado" na análise.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ai-coach/index.ts` | `restingHr` min de 20 → 0 |

