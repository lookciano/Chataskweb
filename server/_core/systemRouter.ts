import { z } from "zod";
import { notifyOwner, testPushNotification, cleanupStaleTokens } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  /** Dispara um push de teste real (vai para a sala 300038) e poda tokens mortos. */
  testPush: adminProcedure
    .mutation(async () => {
      return await testPushNotification();
    }),

  /** Varre todos os device tokens, remove os órfãos/inválidos (ex.: projeto FCM antigo). */
  cleanupTokens: adminProcedure
    .mutation(async () => {
      return await cleanupStaleTokens();
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
