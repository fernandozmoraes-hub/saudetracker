

## Plano: Google OAuth + Melhorias na Autenticacao

### Contexto

O app ja possui autenticacao email/senha funcional (useAuth, Auth.tsx, ProtectedRoute). O plano adiciona Google OAuth e melhora a UX da tela de login conforme solicitado.

### Importante: O que o Lovable Cloud ja gerencia

Muitos dos requisitos listados (bcrypt/argon2, httpOnly cookies, rate limiting, JWT expiration, middleware) sao gerenciados automaticamente pelo backend de autenticacao do Lovable Cloud. Nao precisamos implementar isso manualmente — o sistema ja cuida de:
- Hash seguro de senhas (bcrypt)
- Sessoes JWT com refresh automatico
- Protecao contra brute force (rate limiting nativo)
- Armazenamento seguro de tokens

### Alteracoes

**1. PWA: Adicionar `/~oauth` ao denylist do service worker**

`vite.config.ts` — adicionar `navigateFallbackDenylist: [/^\/~oauth/]` ao workbox config para que redirecionamentos OAuth nunca sejam cacheados pelo service worker.

**2. Configurar Google OAuth**

Usar a ferramenta `Configure Social Auth` para gerar o modulo `src/integrations/lovable/` com suporte a Google OAuth gerenciado pelo Lovable Cloud. Nenhuma API key necessaria.

**3. Atualizar `src/hooks/useAuth.tsx`**

- Adicionar funcao `signInWithGoogle()` que chama `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Adicionar funcao `resetPassword(email)` que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Exportar ambas no contexto

**4. Redesenhar `src/pages/Auth.tsx`**

Nova estrutura da tela:
- Titulo: "Performance Health Dashboard"
- Botao principal: "Entrar com Google" (azul, com icone Google)
- Separador: "OU"
- Campos Email + Senha
- Botoes: Entrar / Criar conta
- Link: "Esqueci minha senha" (abre modal ou estado inline para digitar email e enviar reset)
- Validacao de senha mais forte no cadastro: min 8 chars, 1 maiuscula, 1 numero, 1 especial

**5. Criar pagina `/reset-password`**

Novo arquivo `src/pages/ResetPassword.tsx`:
- Detecta `type=recovery` no URL hash
- Mostra formulario para nova senha
- Chama `supabase.auth.updateUser({ password })`
- Redireciona para login apos sucesso

**6. Adicionar rota em `src/App.tsx`**

- Adicionar `<Route path="/reset-password" element={<ResetPassword />} />` (rota publica)

**7. Logout no Settings**

O logout ja existe via `useAuth().signOut()`. Verificar se o botao de logout esta presente na pagina Settings — se nao, adicionar.

### Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `vite.config.ts` | Adicionar navigateFallbackDenylist para /~oauth |
| `src/integrations/lovable/` | Gerado pela ferramenta Configure Social Auth |
| `src/hooks/useAuth.tsx` | Adicionar signInWithGoogle + resetPassword |
| `src/pages/Auth.tsx` | Redesenhar com Google button + esqueci senha |
| `src/pages/ResetPassword.tsx` | Criar pagina de reset de senha |
| `src/App.tsx` | Adicionar rota /reset-password |

### Nao sera alterado
- Banco de dados (auth.users gerenciado pelo Lovable Cloud)
- ProtectedRoute (ja funciona)
- Edge functions
- Logica de TSS/CTL/ATL/TSB

