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
2. Choose existing identity (Luciano, Larissa, Sérgio, etc.)
3. Confirm chat history + tasks still present

## Local
- `.env.local` is gitignored and mirrors Render env for local runs
- `pnpm dev` or `pnpm build && pnpm start`
