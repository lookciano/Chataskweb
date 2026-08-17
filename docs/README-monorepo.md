# Documentação / Snapshot

Estrutura e configurações nativas dos apps (Android e iOS) que **vivem no monorepo** `lookciano/Chataskweb` como fonte única de verdade.

## Android (`/android`)

Projeto nativo **Capacitor** versionado (código-fonte), package `com.gste.chattask`, Firebase `chataskandroid`.

**Versionado no repo:**
- `app/src/main/java/com/gste/chattask/MainActivity.java` — push (canal FCM) + WebView
- `app/src/main/AndroidManifest.xml` — permissões de notificação
- `app/build.gradle` — versão (versionCode/versionName) e **config de assinatura**
- `build.gradle`, `gradle/wrapper/*`, `variables.gradle`, ícones/res, etc.

**NÃO se commita (segurança):**
- Keystores: `android/chat-task.keystore`, `android/chattask_nova_chave.jks`
- `google-services.json` (credencial Firebase — recoloque localmente após clonar)
- `android/app/build/`, `android/local.properties`, assets gerados

**Chave de assinatura de upload (Play):** `chattask_nova_chave.jks` precisa ser restaurada localmente
antes de buildar release. Segue localizada em `~/Documents/App Luciano/ChaTask Android/signing/`.

## iOS (`docs/ios`)

Snapshot da configuração nativa iOS (referência). O projeto iOS completo vive localmente em
`~/Documents/App Luciano/Chat Task/Repositorio/Chat Task IOS/` (não versionado aqui por conter
`GoogleService-Info.plist` — credencial Firebase — e o Xcode project gerado).

**Snapshot inclui:**
- `App/AppDelegate.swift` — registro de push/APNs + Capacitor
- `App/Info.plist` — UIBackgroundModes (remote-notification), ATS
- `App/App.entitlements` — aps-environment
- `xcodeproj/project.pbxproj` — team/assinatura (PGKDKS7ZG8), bundle `com.lookciano.chattask`
- `capacitor.config.ts` — hostname onrender, PushNotifications presentationOptions

> Após clonar, restaurar localmente: `GoogleService-Info.plist`, `.p8` do APNs, e o projeto `Chat Task IOS/`.

## Como atualizar o app (fluxo recomendado)

1. **Web (fonte da verdade):** edite em `client/`, `server/`, `drizzle/` aqui no monorepo → `pnpm run build` → `git push` (Render auto-deploy).
2. **Android:** `npx cap sync android` → build AAB → assinar → Play Console.
3. **iOS:** sincronizar p/ `Chat Task IOS/` → archive via Xcode → App Store Connect.
