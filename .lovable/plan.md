## Plano

Duas ações operacionais, sem alterar código funcional:

### 1. Deploy da edge function `strava-webhook`
- A função já existe em `supabase/functions/strava-webhook/index.ts` e está declarada em `supabase/config.toml` com `verify_jwt = false` (obrigatório para o Strava chamar o handshake e enviar eventos).
- Publicar via `supabase--deploy_edge_functions` com `["strava-webhook"]`.
- Após deploy, validar que `GET /functions/v1/strava-webhook` responde 200 (não mais 404), executando um `curl` simples.

### 2. Aplicar a migration `20260706210000_athletes_update_own_training_plans.sql`
- Conteúdo: cria a policy `Athletes can update their training plans` em `public.training_plans`, permitindo `UPDATE` quando `auth.uid() = athlete_id`.
- Executar via `supabase--migration` com exatamente o mesmo SQL do arquivo (a policy será criada no banco).
- Necessária para o botão "marcar como concluído" do atleta; o webhook usa service role e não depende dela.

### Fora de escopo
- Nenhuma alteração em código, cálculos, TSS/CTL/ATL/TSB/PMC, Performance Coach, UI ou schema além da policy citada.
- Não registrar assinatura do webhook no Strava (isso é passo separado do usuário via `?action=subscribe`).

### Validação pós-deploy
- `curl` no endpoint público do webhook confirmando resposta 200.
- Confirmar via `read_query` que a policy nova aparece em `pg_policies` para `training_plans`.