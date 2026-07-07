## Objetivo
Executar a exclusão do registro `user_roles` com ID `fb79946f-c2be-4307-a921-34b600ed1f9d`, removendo assim o papel `coach` do usuário `b0683d0d-be61-4bbf-869e-e7ff24dc6cf5`.

## Contexto
Consulta anterior confirmou que o usuário possui dois papéis:
- `athlete` (ID `fd2042e9-aacc-4311-bc3f-1bf7ea78722a`)
- `coach` (ID `fb79946f-c2be-4307-a921-34b600ed1f9d`)

A exclusão afeta apenas o papel `coach`; o papel `athlete` permanece inalterado.

## Ação
```sql
DELETE FROM user_roles WHERE id = 'fb79946f-c2be-4307-a921-34b600ed1f9d';
```

## Verificação
Após a execução, confirmar que o usuário possui apenas o papel `athlete`:
```sql
SELECT * FROM user_roles WHERE user_id = 'b0683d0d-be61-4bbf-869e-e7ff24dc6cf5';
```

## Impacto
- O usuário deixa de ter permissões de coach no sistema.
- Relacionamentos em `coach_athletes` não são removidos automaticamente por este comando; se desejado, podemos limpar vínculos ativos de coach em seguida.