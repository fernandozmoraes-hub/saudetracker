

## Plano: Aplicar Migration de Workout Templates

### Ação

Executar a migration SQL que cria a tabela `workout_templates` com:

1. **Tabela `workout_templates`** — armazena templates de treino do coach (`id`, `coach_id`, `name`, `type`, `planned_duration_min`, `planned_zone`, `planned_tss`, `notes`)
2. **RLS policy** — coaches gerenciam apenas seus próprios templates (ALL com `auth.uid() = coach_id`)
3. **Índice** em `coach_id`

### Execução

| Passo | Ação |
|-------|------|
| 1 | Executar migration SQL via ferramenta de migração |

Nenhuma alteração de código necessária (já feito via GitHub).

