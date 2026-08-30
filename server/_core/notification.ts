import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import {
  getDeviceTokensForRoom,
  getChatRoomById,
  getAllDeviceTokens,
  removeDeviceTokensByToken,
} from "../db";
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
    console.warn("[FCM] Erro ao inicializar Firebase", error instanceof Error ? error.name : "unknown");
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
    const fbOk = initFirebase();
    console.log(`[FCM] Firebase initialized: ${fbOk}`);
    if (!fbOk) {
      console.log("[FCM] FIREBASE_SERVICE_ACCOUNT env var:", process.env.FIREBASE_SERVICE_ACCOUNT ? "SET (" + process.env.FIREBASE_SERVICE_ACCOUNT.length + " chars)" : "NOT SET");
      return;
    }

    const room = await getChatRoomById(chatRoomId);
    const roomName = room?.name || "Sala";

    const tokenRecords = await getDeviceTokensForRoom(chatRoomId, senderId);
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
      apns: {
        payload: {
          aps: {
            alert: {
              title: `${senderName} · ${roomName}`,
              body: preview,
            },
            sound: "default",
            badge: 1,
            "mutable-content": 1,
          } as any,
        },
      },
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Push enviado: ${response.successCount} sucesso, ${response.failureCount} falha`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`[FCM] Token ${idx} falhou`, resp.error?.code);
        }
      });
    }
  } catch (error: any) {
    console.warn("[FCM] Erro ao enviar push", error instanceof Error ? error.name : "unknown");
  }
}

/** Função de teste que retorna o resultado do push (para diagnóstico) e poda tokens mortos. */
export async function testPushNotification(): Promise<{
  success: boolean;
  error?: string;
  tokensCount?: number;
  removed?: number;
}> {
  try {
    const fbOk = initFirebase();
    if (!fbOk) return { success: false, error: "Firebase não inicializado" };

    // Buscar todos os tokens
    const { getDeviceTokensForRoom } = await import("../db");
    // Usar sala 300038 onde o Luciano (userId 1) está
    const tokens = await getDeviceTokensForRoom(300038, 180001);
    if (tokens.length === 0) return { success: false, error: "Nenhum token encontrado", tokensCount: 0, removed: 0 };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t: {token: string}) => t.token),
      notification: { title: "Teste Push", body: "Notificação de teste do Chat Task" },
      data: { type: "test" },
      apns: {
        payload: {
          aps: {
            alert: { title: "Teste Push", body: "Notificação de teste do Chat Task" },
            sound: "default",
          } as any,
        },
      },
      android: {
        notification: {
          channelId: "chat_messages",
          priority: "high" as any,
          icon: "ic_launcher",
          color: "#0f766e",
        },
      },
    });

    const errors: string[] = [];
    const deadTokens: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        errors.push(`Token ${idx}: ${resp.error?.message} (${resp.error?.code})`);
        if (isDeadTokenError(resp.error)) {
          const t = (tokens as any[])[idx];
          if (t?.token) deadTokens.push(t.token);
        }
      }
    });

    let removed = 0;
    if (deadTokens.length > 0) {
      removed = await removeDeviceTokensByToken(deadTokens);
    }

    return {
      success: response.successCount > 0,
      error: errors.length > 0 ? errors.join("; ") : undefined,
      tokensCount: tokens.length,
      removed,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Decide se um erro FCM significa token morto/órfão (deve ser removido do banco).
 * Cobre: registro inválido, token não registrado/unregistered, e sender (projeto) diferente.
 */
function isDeadTokenError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || error || "").toLowerCase();
  const text = `${code} ${msg}`.toLowerCase();
  return (
    text.includes("invalid-registration") ||
    text.includes("registration-token-not-registered") ||
    text.includes("invalid-registration-token") ||
    text.includes("not-registered") ||
    text.includes("unregistered") ||
    text.includes("sender-id-mismatch") ||
    text.includes("mismatchsenderid") ||
    text.includes("mismatch senderid") ||
    text.includes("apns-token-not-registered")
  );
}

/**
 * Limpa device tokens órfãos/inválidos em todo o sistema disparando uma checagem
 * FCM por lotes (mensagem silenciosa, sem visibilidade para o usuário) e removendo
 * os tokens que o FCM rejeita como não registrados / de outro projeto.
 * Útil após unificar projetos Firebase (ex.: tokens iOS do projeto antigo).
 */
export async function cleanupStaleTokens(): Promise<{
  checked: number;
  removed: number;
  removedIos: number;
  errors: string[];
}> {
  const fbOk = initFirebase();
  if (!fbOk) return { checked: 0, removed: 0, removedIos: 0, errors: ["Firebase não inicializado"] };

  const records = await getAllDeviceTokens();
  if (records.length === 0) return { checked: 0, removed: 0, removedIos: 0, errors: [] };

  const messaging = getMessaging();
  const errors: string[] = [];
  const deadTokens: string[] = [];

  // FCM aceita no máximo 500 tokens por chamada multicast
  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const batchTokens = batch.map((r: any) => r.token);
    let resp;
    try {
      // Mensagem silenciosa: apenas data, sem notification -> não exibe banner
      resp = await messaging.sendEachForMulticast({
        tokens: batchTokens,
        data: { type: "cleanup", silent: "1" },
      });
    } catch (error: any) {
      errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error?.message || error}`);
      continue;
    }

    resp.responses.forEach((r: any, idx: number) => {
      // erros transitórios (quota/rate) não são tratados como token morto
      if (!r.success && isDeadTokenError(r.error)) {
        deadTokens.push(batch[idx].token);
      }
    });
  }

  let removed = 0;
  let removedIos = 0;
  if (deadTokens.length > 0) {
    removed = await removeDeviceTokensByToken(deadTokens);
    // quantos dos removidos eram iOS (informação extra)
    const deadSet = new Set(deadTokens.map((t) => t.toLowerCase()));
    removedIos = records.filter(
      (r: any) => r.platform === "ios" && deadSet.has(r.token.toLowerCase())
    ).length;
  }

  return { checked: records.length, removed, removedIos, errors };
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
