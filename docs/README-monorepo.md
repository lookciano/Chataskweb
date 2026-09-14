# Monorepo Chatask

O repositório `lookciano/Chataskweb` é o repositório oficial e único para as três versões do Chatask:

- Web: React + Vite
- iOS: Capacitor + Xcode
- Android: Capacitor + Android Studio/Gradle

## Mapa das Pastas

| Pasta | Responsabilidade |
| --- | --- |
| `client/` | Interface Web compartilhada por Web, iOS e Android |
| `server/` | API, tRPC, autenticação, push, IA e integrações |
| `shared/` | Tipos e funções usadas no client e server |
| `drizzle/` | Schema e migrations de banco |
| `ios/` | Projeto nativo iOS gerado/gerenciado pelo Capacitor |
| `android/` | Projeto nativo Android gerado/gerenciado pelo Capacitor |
| `dist/` | Build gerado, não deve ser editado manualmente |
| `docs/` | Documentação operacional do projeto |

## Fonte da Verdade

Edite funcionalidades em:

- `client/src/` para telas, componentes, hooks e estilos
- `server/` para API e regras de backend
- `shared/` para tipos/regras compartilhadas
- `drizzle/` para schema/migrations

Evite editar diretamente arquivos gerados em:

- `dist/`
- `ios/App/App/public/`
- `android/app/src/main/assets/public/`

Essas pastas são atualizadas por `pnpm ios:sync`, `pnpm android:sync` ou `pnpm cap:sync`.

## Configuração Capacitor

O arquivo central é `capacitor.config.ts`.

Configuração importante:

- `server.hostname` deve ficar como `localhost`
- `allowNavigation` deve permitir `chataskweb.onrender.com`
- O backend real chamado pelo app está em `client/src/main.tsx`

Isso evita que o WebView iOS intercepte chamadas para `chataskweb.onrender.com`, problema que causava falhas de login.

## Web/API

Render publica a branch `main` deste repositório.

Fluxo:

```bash
pnpm check
pnpm build
git push origin main
```

Depois do push, aguarde o deploy automático no Render.

## iOS

Projeto:

```text
ios/App/App.xcodeproj
```

Fluxo:

```bash
pnpm ios:sync
pnpm ios:open
```

No Xcode:

1. Selecione o target `App`
2. Use o bundle id correto
3. Faça `Product > Clean Build Folder`
4. Rode no iPhone ou faça Archive para App Store Connect

Arquivos sensíveis que não devem ir para Git:

- `GoogleService-Info.plist`
- certificados e chaves APNs
- arquivos de DerivedData/build

## Android

Projeto:

```text
android/
```

Fluxo:

```bash
pnpm android:sync
pnpm android:debug
```

Para release, restaure localmente o keystore e rode:

```bash
pnpm android:release
```

Arquivos sensíveis que não devem ir para Git:

- `google-services.json`
- `*.jks`
- `*.keystore`
- `android/local.properties`

## Checklist Antes de Publicar

- `pnpm check`
- `pnpm build`
- `pnpm ios:sync` se mudou mobile
- `pnpm android:sync` se mudou mobile
- Testar login no iOS quando houver mudança de autenticação
- Testar login Web após deploy do Render

