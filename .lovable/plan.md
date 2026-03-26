

## Plano Revisado: Plataforma de Coaching Multi-Atleta (com Emendas 1 e 2)

### Emendas Incorporadas

**Emenda 1 — Migração para usuários existentes:** A migration SQL incluirá um `INSERT INTO user_roles` que atribui `athlete` a todos os usuários já existentes em `auth.users`, garantindo que ninguém fique preso na tela de seleção de role.

**Emenda 2 — Salvaguarda da BottomNav:** Enquanto `useUserRole` estiver com `isLoading = true`, a BottomNav renderiza a navegação padrão de atleta (a atual). Só exibe navegação de coach quando `isCoach === true` e `isLoading === false`.

---

### Parte 1: Banco de Dados (Migration SQL)

**1.1 Criar tipo, tabelas e funções**

```sql
-- Tipo de role
CREATE TYPE public.app_role AS ENUM ('coach', 'athlete');

-- Tabela user_roles (nunca no perfil)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar role sem recursão RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para checar relação coach-atleta
CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id uuid, _athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_athletes
    WHERE coach_id = _coach_id AND athlete_id = _athlete_id AND status = 'active'
  )
$$;

-- EMENDA 1: Migrar usuários existentes como athlete
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'athlete'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Tabela coach_athletes
CREATE TABLE public.coach_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);
ALTER TABLE public.coach_athletes ENABLE ROW LEVEL SECURITY;

-- Tabela training_plans
CREATE TABLE public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  date date NOT NULL,
  type text NOT NULL,
  planned_duration_min numeric,
  planned_zone text,
  planned_tss numeric,
  notes text,
  status text NOT NULL DEFAULT 'planned',
  workout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
```

**1.2 RLS policies**

- `user_roles`: usuário vê suas próprias roles; INSERT para authenticated
- `coach_athletes`: coach vê/insere suas relações; atleta vê suas relações (SELECT only)
- `training_plans`: coach CRUD nos planos dos seus atletas; atleta SELECT only nos seus planos
- Tabelas existentes (`daily_checks`, `workouts`, `body_composition`, `alcohol_intake`, `equipment`, `workout_evaluations`): adicionar policy SELECT para coaches dos atletas ativos via `is_coach_of()`

---

### Parte 2: Hook `useUserRole`

Novo arquivo `src/hooks/useUserRole.tsx`:
- Busca role do user em `user_roles`
- Expõe: `role`, `isCoach`, `isAthlete`, `isLoading`, `setRole(newRole)`
- Se user não tem role (novo user pós-migration), redireciona para `/select-role`

---

### Parte 3: BottomNav — Emenda 2

**`src/components/layout/BottomNav.tsx`:**

```text
if (isLoading || isAthlete || !role) → navegação padrão atual (6 itens atleta)
if (isCoach && !isLoading) → navegação de coach (Dashboard, Atletas, Prescrever, Calendário, Config)
```

A BottomNav NUNCA fica em branco. O fallback é sempre a nav de atleta.

---

### Parte 4: Páginas Novas

| Página | Path | Descrição |
|--------|------|-----------|
| `SelectRole.tsx` | `/select-role` | Onboarding: "Sou Coach" / "Sou Atleta" |
| `CoachDashboard.tsx` | `/coach` | Lista de atletas com métricas resumidas |
| `CoachAthleteProfile.tsx` | `/coach/athlete/:id` | Perfil detalhado do atleta (reutiliza componentes existentes) |
| `PrescribeWorkout.tsx` | `/coach/prescribe` | Formulário de prescrição de treino |

---

### Parte 5: Hooks Novos

| Hook | Descrição |
|------|-----------|
| `useUserRole` | Gerencia role do usuário |
| `useCoachAthletes` | CRUD de relações coach-atleta |
| `useTrainingPlans` | CRUD de planos de treino |

---

### Parte 6: Alterações em Arquivos Existentes

| Arquivo | Alteração |
|---------|-----------|
| `BottomNav.tsx` | Nav condicional por role com fallback atleta (Emenda 2) |
| `ProtectedRoute.tsx` | Prop opcional `requiredRole` |
| `App.tsx` | Novas rotas (`/select-role`, `/coach`, `/coach/athlete/:id`, `/coach/prescribe`) |
| `useData.tsx` | Função para buscar dados de outro usuário (para coach) |

### Não Será Alterado

- Lógica de CTL/ATL/TSB/TSS
- Edge functions existentes
- Estrutura das tabelas existentes (apenas novas RLS policies)
- Fluxo de autenticação

### Ordem de Implementação

1. Migration SQL (tabelas + RLS + migração de usuários existentes)
2. `useUserRole` + `SelectRole` + onboarding
3. `BottomNav` condicional com salvaguarda
4. `ProtectedRoute` com `requiredRole`
5. Dashboard do coach + perfil do atleta
6. Prescrição de treinos
7. Feedback loop + alertas inteligentes

