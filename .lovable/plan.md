

## Plano: Adicionar Composição Corporal à BottomNav (mantendo Calendário)

### O que muda

A barra de navegação inferior passará de 5 para 6 itens, adicionando "Corporal" sem remover nenhum item existente.

### Nova hierarquia da BottomNav

```text
Check-in | Treino | Hoje | Calendário | Corporal | Config
  Heart   Dumbbell  Home   Calendar     Scale    Settings
```

### Alterações

**1. `src/components/layout/BottomNav.tsx`**

- Importar o ícone `Scale` do lucide-react
- Adicionar novo item `{ path: '/body-composition', label: 'Corporal', icon: Scale }` entre Calendário e Config
- Reduzir o padding horizontal dos itens de `px-3` para `px-1.5` para acomodar 6 itens confortavelmente

**2. `src/pages/Settings.tsx`**

- Remover o bloco de link para Composição Corporal (já que terá acesso direto pela BottomNav)

### Nenhuma outra alteração necessária

- A rota `/body-composition` já existe em `App.tsx`
- A página `BodyComposition.tsx` já está implementada

