

## Plano: Corrigir erro ao definir perfil

### Diagnóstico

O usuário já possui **duas** roles no banco (`athlete` e `coach`). Quando tenta selecionar uma role na tela `/select-role`, o INSERT falha por violação da constraint `UNIQUE (user_id, role)`.

O hook `useUserRole` usa `.insert()` sem tratar conflitos.

### Correção

**Arquivo: `src/hooks/useUserRole.tsx`**

Alterar a função `setRole` para usar `.upsert()` com `onConflict: 'user_id, role'` em vez de `.insert()`. Isso resolve o conflito quando o usuário já possui a role.

```typescript
const { error } = await supabase
  .from('user_roles')
  .upsert(
    { user_id: user.id, role: newRole },
    { onConflict: 'user_id,role' }
  );
```

Adicionalmente, precisa de uma RLS policy de UPDATE na tabela `user_roles` (atualmente ausente), ou usar `ignoreDuplicates: true` no upsert para simplesmente ignorar se já existe:

```typescript
const { error } = await supabase
  .from('user_roles')
  .upsert(
    { user_id: user.id, role: newRole },
    { onConflict: 'user_id,role', ignoreDuplicates: true }
  );
```

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useUserRole.tsx` | Trocar `.insert()` por `.upsert()` com `ignoreDuplicates: true` |

