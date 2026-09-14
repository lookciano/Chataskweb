# Caminhos Locais e Repositórios

Use esta página sempre que for atualizar o Chatask.

## Repositório Oficial

GitHub:

```text
https://github.com/lookciano/Chataskweb
```

Este é o repositório que deve receber novas alterações de Web, iOS e Android.

## Cópia Local Recomendada

Use esta pasta como cópia local principal:

```text
/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chataskweb
```

Se essa pasta não existir, crie com:

```bash
cd "/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio"
git clone https://github.com/lookciano/Chataskweb.git Chataskweb
```

## Pastas Dentro do Repositório

```text
Chataskweb/
  client/      Web frontend usado também no app mobile
  server/      Backend/API publicado no Render
  shared/      Código compartilhado
  drizzle/     Banco e migrations
  ios/         Projeto iOS
  android/     Projeto Android
  docs/        Documentação
```

## Caminhos de Projeto

Web/API:

```text
/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chataskweb
```

iOS/Xcode:

```text
/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chataskweb/ios/App/App.xcodeproj
```

Android/Android Studio:

```text
/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chataskweb/android
```

## Repositórios Antigos

Evite usar este repositório para novas alterações:

```text
/Users/lucianograndesertao/Documents/App Luciano/Chat Task/Repositorio/Chat Task IOS
```

Ele aponta para:

```text
https://github.com/lookciano/chat-atividades-ia.git
```

Esse repositório ficou antigo/divergente e foi a origem da confusão entre versões.

## Como Conferir se Você Está no Lugar Certo

Rode:

```bash
git remote -v
```

O resultado correto deve conter:

```text
https://github.com/lookciano/Chataskweb.git
```

Depois rode:

```bash
git status --short --branch
```

Você deve estar na branch:

```text
main
```

