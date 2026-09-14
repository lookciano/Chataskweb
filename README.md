# Chatask

Este repositório é a fonte oficial do Chatask para Web, iOS e Android.

- Produção Web/API: https://chataskweb.onrender.com
- GitHub oficial: https://github.com/lookciano/Chataskweb
- Backend de produção: Render, a partir da branch `main`
- App mobile: Capacitor usando o mesmo frontend React em `client/`

## Estrutura

| Área | Pasta | O que contém |
| --- | --- | --- |
| Web frontend | `client/` | React, telas, componentes e estilos |
| Backend/API | `server/` | Express, tRPC, autenticação, IA, notificações |
| Código compartilhado | `shared/` | Tipos e utilitários usados por client/server |
| Banco/migrations | `drizzle/` | Schema e migrations do banco |
| iOS | `ios/` | Projeto Xcode/Capacitor versionado |
| Android | `android/` | Projeto Android/Capacitor versionado |
| Deploy web | `render.yaml`, `DEPLOY_RENDER.md` | Configuração do Render |
| Operação | `docs/` | Guias de release, caminhos locais e histórico técnico |

## Regras Importantes

1. Trabalhe neste repositório (`Chataskweb`) como fonte única.
2. Não use o repositório antigo `chat-atividades-ia` para novas atualizações.
3. Faça alterações do app em `client/`, `server/`, `shared/` e `drizzle/`.
4. Depois de mexer no app mobile, rode o sync da plataforma desejada.
5. Nunca commite credenciais: `.env`, keystores, `.jks`, `GoogleService-Info.plist`, `google-services.json`.

## Comandos Principais

Instalar dependências:

```bash
pnpm install
```

Rodar localmente:

```bash
pnpm dev
```

Validar TypeScript:

```bash
pnpm check
```

Build Web/API:

```bash
pnpm build
```

Sincronizar iOS:

```bash
pnpm ios:sync
pnpm ios:open
```

Sincronizar Android:

```bash
pnpm android:sync
```

Build Android debug:

```bash
pnpm android:debug
```

## Fluxo Recomendado de Atualização

1. Atualize o repositório:

```bash
git pull origin main
```

2. Edite o código necessário.
3. Rode:

```bash
pnpm check
pnpm build
```

4. Se afetar mobile:

```bash
pnpm ios:sync
pnpm android:sync
```

5. Commit e push:

```bash
git status
git add .
git commit -m "descrição clara da mudança"
git push origin main
```

6. Aguarde o Render publicar a Web/API.
7. Para iOS, abra Xcode pelo projeto em `ios/App/App.xcodeproj`.
8. Para Android, abra Android Studio pela pasta `android/`.

## Documentação

- [Caminhos locais e repositórios](docs/LOCAL_PATHS.md)
- [Release Web, iOS e Android](docs/RELEASES.md)
- [Deploy no Render](DEPLOY_RENDER.md)
- [Monorepo e plataformas](docs/README-monorepo.md)

