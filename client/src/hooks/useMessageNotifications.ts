import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useMessageNotifications() {
  const lastMessageCountRef = useRef(0);
  const notificationPermissionRef = useRef<NotificationPermission>("default");

  // Solicitar permissão para notificações no navegador
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        notificationPermissionRef.current = permission;
      });
    } else if ("Notification" in window) {
      notificationPermissionRef.current = Notification.permission;
    }
  }, []);

  // Função para enviar notificação de nova mensagem
  const notifyNewMessage = (senderName: string, messagePreview: string) => {
    // Toast visual no app (funciona em desktop e mobile)
    toast.info(`${senderName}: ${messagePreview}`, {
      duration: 4000,
      position: "top-right",
    });

    // Web Push Notification (apenas desktop)
    if (
      "Notification" in window &&
      notificationPermissionRef.current === "granted"
    ) {
      try {
        new Notification(`Nova mensagem de ${senderName}`, {
          body: messagePreview,
          icon: "/favicon.ico",
          tag: "chat-notification",
          requireInteraction: false,
        });
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
      }
    }
  };

  // Função para verificar novas mensagens
  const checkForNewMessages = (currentMessageCount: number) => {
    if (currentMessageCount > lastMessageCountRef.current) {
      lastMessageCountRef.current = currentMessageCount;
      return true;
    }
    return false;
  };

  return {
    notifyNewMessage,
    checkForNewMessages,
    setLastMessageCount: (count: number) => {
      lastMessageCountRef.current = count;
    },
  };
}
