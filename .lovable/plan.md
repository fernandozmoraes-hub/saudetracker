## Atualizar STRAVA_CLIENT_ID

O `STRAVA_CLIENT_ID` está salvo como secret no backend e é usado pelas edge functions `strava-auth`, `strava-import` e `strava-webhook` para OAuth e chamadas à API do Strava.

### Ação
- Atualizar o secret `STRAVA_CLIENT_ID` para `191813` via `set_secret` (valor não-aleatório, conhecido — não requer interação do usuário).

### Observações
- O `STRAVA_CLIENT_SECRET` atual provavelmente pertence ao Client ID antigo. Se este novo Client ID (191813) é de um app Strava diferente, o `STRAVA_CLIENT_SECRET` também precisa ser atualizado — caso contrário o OAuth vai falhar em "token_exchange_failed". Confirme se devo abrir o formulário para atualizar o `STRAVA_CLIENT_SECRET` também.
- Nenhuma alteração de código é necessária.
