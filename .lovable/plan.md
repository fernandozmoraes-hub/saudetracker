

## Plano: Aplicar Migration de Profiles

### Acao

Executar a migration SQL fornecida que cria:

1. **Tabela `profiles`** com `user_id`, `display_name`, `email`, timestamps
2. **RLS policies** para SELECT (authenticated), INSERT e UPDATE (own user)
3. **Trigger `handle_new_user`** em `auth.users` para criacao automatica de perfil
4. **Populacao** de perfis para usuarios existentes
5. **Indice** em `profiles.email`

### Nota Tecnica Importante

A migration inclui um trigger em `auth.users`. Embora tabelas do schema `auth` sejam reservadas, este pattern especifico (trigger AFTER INSERT para criar perfil) e suportado e recomendado. Sera executado via migration tool.

### Execucao

| Passo | Acao |
|-------|------|
| 1 | Executar migration SQL completa via ferramenta de migracao |
| 2 | Verificar que a tabela `profiles` foi criada com RLS ativo |

Nenhuma alteracao de codigo necessaria (ja feito via GitHub).

