import { useEffect, useRef } from "react";
import { PushNotifications, Token, PushNotificationSchema } from "@capacitor/push-notifications";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Hook que registra o dispositivo para receber push notifications via FCM.
 * Só ativa no Capacitor (Android/iOS). No navegador, é no-op.
 */
export function usePushNotifications() {
  const registerMutation = trpc.auth.registerDevice.useMutation();
  const unregisterMutation = trpc.auth.unregisterDevice.useMutation();
  const tokenRegisteredRef = useRef<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Verifica se está rodando no Capacitor
    const isCapacitor =
      typeof window !== "undefined" && window.location.hostname === "localhost";

    if (!isCapacitor) return;

    let mounted = true;

    const setupPush = async () => {
      try {
        // Solicitar permissão
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") {
          console.log("[Push] Permissão de notificação negada");
          return;
        }

        // Registrar no FCM
        await PushNotifications.register();

        // Escutar token
        PushNotifications.addListener("registration", (token: Token) => {
          if (!mounted) return;
          if (tokenRegisteredRef.current === token.value) return;
          tokenRegisteredRef.current = token.value;
          console.log("[Push] Token FCM recebido:", token.value.substring(0, 20) + "...");

          // Enviar token para o backend
          registerMutation.mutate({ token: token.value, platform: "android" });
        });

        // Escutar notificações recebidas com app aberto
        PushNotifications.addListener(
          "pushNotificationReceived",
          (notification: PushNotificationSchema) => {
            console.log("[Push] Notificação recebida:", notification.title);
          }
        );

        // Escutar clique na notificação
        PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            console.log("[Push] Notificação clicada:", action.notification.data);
            // Aqui podemos navegar para a sala da mensagem
            const data = action.notification.data;
            if (data?.chatRoomId) {
              // Disparar evento custom para o ChatApp capturar e trocar de sala
              window.dispatchEvent(
                new CustomEvent("push-notification-click", {
                  detail: { chatRoomId: Number(data.chatRoomId) },
                })
              );
            }
          }
        );

        console.log("[Push] Notificações configuradas");
      } catch (error) {
        console.warn("[Push] Erro ao configurar notificações:", error);
      }
    };

    setupPush();

    return () => {
      mounted = false;
    };
  }, [user]);
}
