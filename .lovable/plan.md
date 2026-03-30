

## Plano: Aplicar Migrations de Workout Feedback e Messages

### Ação

Executar uma migration SQL única contendo:

1. **Tabela `workout_feedback`** — feedback do coach em treinos do atleta, com RLS para coach (ALL) e atleta (SELECT), índices em `workout_id` e `athlete_id`
2. **Tabela `messages`** — mensagens entre coach e atleta, com RLS para visualização, envio e marcação de leitura, índice composto em `(coach_id, athlete_id, created_at DESC)`

### Execução

| Passo | Ação |
|-------|------|
| 1 | Executar migration SQL completa via ferramenta de migração |

Nenhuma alteração de código necessária (já feito via GitHub).

