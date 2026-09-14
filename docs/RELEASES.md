# Release Web, iOS e Android

Este guia descreve como atualizar cada versão do Chatask sem misturar arquivos antigos.

## Antes de Começar

Entre na cópia local oficial:

```bash
cd "/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chataskweb"
git pull origin main
pnpm install
```

Valide:

```bash
pnpm check
pnpm build
```

## Web/API

A Web e a API são publicadas pelo Render a partir da branch `main`.

Passos:

```bash
pnpm check
pnpm build
git status
git add .
git commit -m "descrição da alteração"
git push origin main
```

Depois do push:

1. Aguarde o deploy automático no Render
2. Abra https://chataskweb.onrender.com
3. Teste login, salas, mensagens e tarefas

## iOS

O iOS usa o mesmo app React, sincronizado via Capacitor.

Passos:

```bash
pnpm ios:sync
pnpm ios:open
```

No Xcode:

1. Selecione o target `App`
2. Faça `Product > Clean Build Folder`
3. Rode no iPhone pelo cabo para teste
4. Para publicar, use `Product > Archive`
5. Envie para App Store Connect

Quando testar login no iPhone:

- Se o login falhar sem mensagem, confira se o backend do Render terminou o deploy
- No console do Xcode, filtre por `ChatTask API`
- Apague o app do iPhone quando quiser limpar sessão antiga

## Android

O Android usa o mesmo app React, sincronizado via Capacitor.

Debug:

```bash
pnpm android:debug
```

Release:

```bash
pnpm android:release
```

Antes do release, confirme que os arquivos locais de assinatura existem e não estão commitados:

- keystore `.jks` ou `.keystore`
- `google-services.json`
- `android/local.properties`

## Quando Mudar Autenticação

Sempre faça os três testes:

1. Login Web em https://chataskweb.onrender.com
2. Login iOS instalado pelo Xcode
3. Login Android debug ou release interno

O iOS e Android usam token salvo em `localStorage` e enviado como `Authorization: Bearer ...`, além do cookie web.

## Quando Mudar Backend

O app mobile chama:

```text
https://chataskweb.onrender.com/api/trpc
```

Então:

1. Faça push para `main`
2. Aguarde deploy do Render
3. Só depois teste o app instalado no telefone

## Comandos de Recuperação

Ver status:

```bash
git status --short --branch
```

Ver remoto correto:

```bash
git remote -v
```

Limpar build mobile:

```bash
pnpm ios:sync
pnpm android:sync
```

