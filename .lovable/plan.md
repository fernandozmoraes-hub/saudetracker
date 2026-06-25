## Plano: Desativar "Avaliação do Coach" da página Hoje

### Alterações

1. **`src/pages/Today.tsx`**
   - Remover o import de `AICoach`.
   - Remover o trecho `<AICoach />` do JSX (entre o bloco de Recomendação e o card "Performance Coach").

2. **`src/components/AICoach.tsx`**
   - Não excluir o arquivo. Mantido em disco para reuso futuro.
   - Como deixa de ser importado em qualquer página, o `useEffect` que chama `supabase.functions.invoke('ai-coach')` nunca mais executa automaticamente.

### O que NÃO será alterado
- Edge function `supabase/functions/ai-coach/index.ts` (mantida).
- `Performance Coach` (`/performance-coach`) e o card de acesso em Hoje.
- Cálculos, triggers, check-in, CTL/ATL/TSB/HRV, álcool, body composition, etc.

### Resultado
Ao abrir `/` (Hoje), nenhuma invocação automática da `ai-coach` ocorre. A IA só roda quando o usuário envia pergunta manual no Performance Coach.
