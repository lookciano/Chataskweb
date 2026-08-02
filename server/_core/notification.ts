import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { getDeviceTokensForRoom, getChatRoomById } from "../db";
let firebaseApp: App | null = null;

/**
 * Inicializa Firebase Admin SDK se as credenciais estiverem configuradas.
 * No Render, a env var FIREBASE_SERVICE_ACCOUNT contém o JSON da service account.
 */
function initFirebase(): boolean {
  if (firebaseApp) return true;
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return true;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) return false;

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("[FCM] Firebase Admin SDK inicializado");
    return true;
  } catch (error) {
    console.warn("[FCM] Erro ao inicializar Firebase:", error);
    return false;
  }
}

/**
 * Envia push notification para os membros de uma sala quando chega uma nova mensagem.
 */
export async function sendPushNotificationForMessage(
  chatRoomId: number,
  senderId: number,
  senderName: string,
  messageContent: string
) {
  try {
    console.log(`[FCM] Iniciando push: room=${chatRoomId}, sender=${senderId}, name=${senderName}`);
    const fbOk = initFirebase();
    console.log(`[FCM] Firebase initialized: ${fbOk}`);
    if (!fbOk) {
      console.log("[FCM] FIREBASE_SERVICE_ACCOUNT env var:", process.env.FIREBASE_SERVICE_ACCOUNT ? "SET (" + process.env.FIREBASE_SERVICE_ACCOUNT.length + " chars)" : "NOT SET");
      return;
    }

    const room = await getChatRoomById(chatRoomId);
    const roomName = room?.name || "Sala";
    console.log(`[FCM] Room: ${roomName}`);

    const tokenRecords = await getDeviceTokensForRoom(chatRoomId, senderId);
    console.log(`[FCM] Tokens found: ${tokenRecords.length}`, tokenRecords.map((t: {userId: number}) => t.userId));
    if (tokenRecords.length === 0) {
      console.log("[FCM] No tokens — no one to notify (sender excluded or no members with tokens)");
      return;
    }

    const tokens: string[] = tokenRecords.map((t: { token: string; userId: number }) => t.token);

    const preview = messageContent.length > 100
      ? messageContent.substring(0, 100) + "..."
      : messageContent;

    const message: MulticastMessage = {
      tokens,
      notification: {
        title: `${senderName} · ${roomName}`,
        body: preview,
      },
      data: {
        chatRoomId: String(chatRoomId),
        type: "new_message",
        senderName,
        roomName,
      },
      android: {
        notification: {
          channelId: "chat_messages",
          priority: "high" as any,
          icon: "ic_launcher",
          color: "#0f766e",
        },
      },
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Push enviado: ${response.successCount} sucesso, ${response.failureCount} falha`);
  } catch (error) {
    console.warn("[FCM] Erro ao enviar push:", error);
  }
}

/**
 * Notifica o dono da plataforma (legado — systemRouter.notifyOwner).
 * Mantido para compatibilidade com o systemRouter existente.
 */
export async function notifyOwner(input: { title: string; content: string }): Promise<boolean> {
  // No-op — sem implementação de push para owner no momento.
  // Retorna true para não quebrar o systemRouter.
  return true;
}
