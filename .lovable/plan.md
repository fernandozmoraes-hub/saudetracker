## Diagnóstico

A tabela `public.alcohol_intake` está sem `GRANT` para `authenticated` e `service_role`. Sem isso, o Data API (PostgREST) bloqueia INSERT/SELECT do app mesmo com RLS correta — por isso novos registros não persistem e o Performance Coach lê o histórico vazio (`alcoholTrend: null`).

Confirmado:
- `information_schema.role_table_grants` para `alcohol_intake` retorna vazio.
- Policies RLS estão corretas (`auth.uid() = user_id`).
- Integração no `performanceContext.ts` está OK — depende só dos dados chegarem.
- `useAlcoholIntake.saveEntry`/`deleteEntry` apenas fazem `console.error` em falha — usuário não vê o erro.

## Correção

### 1. Migração — restaurar GRANTs
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alcohol_intake TO authenticated;
GRANT ALL ON public.alcohol_intake TO service_role;
```

### 2. `src/hooks/useAlcoholIntake.tsx` — feedback de erro
- Importar `toast` de `sonner`.
- Em `saveEntry` e `deleteEntry`, ao receber `error`, disparar `toast.error(error.message)` além do `console.error`.

## Garantias
- Mexe apenas em permissões da tabela `alcohol_intake` e no hook que a consome.
- Não altera schema, RLS, cálculos, Performance Coach, edge functions ou demais módulos.
- Dados existentes preservados.
