# Deploy Render — Chataskweb

## Service
- Repo: lookciano/Chataskweb
- Build: `pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start`
- Bind: `0.0.0.0:$PORT`

## Env vars (set in Render dashboard)
- DATABASE_URL = TiDB Cloud URL (database `test`)
- JWT_SECRET = long random secret
- NODE_ENV = production
- OPENROUTER_API_KEY = sk-or-...
- OPENROUTER_MODEL = deepseek/deepseek-v4-flash
- APP_URL = https://chataskweb.onrender.com
- ROOM_ADMIN_PASSWORD = (optional room create/delete password)
- PORT = provided by Render (do not hardcode differently)

## After deploy
1. Open app URL
2. Faça login com email e senha
3. Confirme salas, histórico de chat e tarefas
4. Se a mudança envolver autenticação, teste também o app iOS/Android depois que o deploy terminar

## Local
- `.env.local` is gitignored and mirrors Render env for local runs
- `pnpm dev` or `pnpm build && pnpm start`

## Mobile dependency

iOS e Android chamam a API publicada em:

```text
https://chataskweb.onrender.com/api/trpc
```

Por isso, alterações em `server/` precisam estar publicadas no Render antes de testar login ou tarefas nos apps nativos.
