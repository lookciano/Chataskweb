import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { ENV } from "./_core/env";
import { createLocalSessionToken } from "./_core/session";
import { extractTasksFromMessage } from "./llm-task-extractor";
import { interpretResponseForTaskUpdate } from "./llm-response-interpreter";
import { detectTaskCompletionInMessage } from "./task-completion-detector";
import { detectTaskAssignmentInMessage } from "./task-assignment-detector";
import { normalizeName, findByNormalizedName } from "../shared/normalizeNames";
import { generateWeeklySummary, calculateWeeklySummaryData } from "./weekly-summary-generator";
import { validateAndFixRoomTasks, getParticipantNameVariations } from "./task-name-validator";
import { getUniqueParticipantNames } from "./participant-name-matcher";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    listIdentities: publicProcedure.query(async () => {
      // Only existing DB people — preserves historical users/responsibles.
      return await db.listSelectableUsers();
    }),
    selectIdentity: publicProcedure
      .input(z.object({
        userId: z.number().int().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        }

        // Guard: only allow selecting known team identities (participants or named users)
        const selectable = await db.listSelectableUsers();
        if (!selectable.some((u) => u.id === user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Identidade não autorizada" });
        }

        const label = user.displayName || user.name || `User ${user.id}`;
        const token = await createLocalSessionToken({
          openId: user.openId,
          name: label,
          userId: user.id,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        await db.touchUserLastSignedIn(user.id);
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        displayName: z.string().min(1).max(255),
      }))
      .mutation(async ({ input, ctx }) => {
        // Rename only the signed-in person — never the hardcoded admin fallback.
        await db.updateUserProfile(ctx.user.id, input.displayName.trim());
        const updated = await db.getUserById(ctx.user.id);
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        }

        // Refresh JWT name claim so cookies stay consistent
        const token = await createLocalSessionToken({
          openId: updated.openId,
          name: updated.displayName || updated.name || `User ${updated.id}`,
          userId: updated.id,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return updated;
      }),
  }),

  chat: router({
    rooms: publicProcedure.query(async () => {
      return await db.getChatRooms();
    }),
    createRoom: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.password !== ENV.roomAdminPassword) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Senha incorreta" });
        }
        const result = await db.createChatRoom({
          name: input.name,
          description: input.description,
          createdBy: ctx.user.id,
        });
        return result;
      }),
    getParticipants: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getParticipants(input.chatRoomId);
      }),
    addParticipant: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.addParticipant(input.chatRoomId, input.userId);
      }),
    deleteRoom: protectedProcedure
      .input(z.object({
        chatRoomId: z.number(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.password !== ENV.roomAdminPassword) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Senha incorreta" });
        }
        return await db.deleteChatRoom(input.chatRoomId);
      }),
  }),

  messages: router({
    list: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
        limit: z.number().min(1).max(100).optional(),
        /** Load messages older than this cursor (infinite scroll up). */
        beforeId: z.number().optional(),
        beforeCreatedAt: z.union([z.string(), z.date()]).optional(),
        /** Load only messages newer than this cursor (polling). */
        afterId: z.number().optional(),
        afterCreatedAt: z.union([z.string(), z.date()]).optional(),
      }))
      .query(async ({ input }) => {
        const toDate = (v: string | Date | undefined) => {
          if (!v) return undefined;
          return v instanceof Date ? v : new Date(v);
        };
        return await db.getMessagesPage({
          chatRoomId: input.chatRoomId,
          limit: input.limit,
          beforeId: input.beforeId,
          beforeCreatedAt: toDate(input.beforeCreatedAt),
          afterId: input.afterId,
          afterCreatedAt: toDate(input.afterCreatedAt),
        });
      }),
    send: protectedProcedure
      .input(z.object({
        chatRoomId: z.number(),
        content: z.string().min(1),
        replyToId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const senderName = db.resolveUserDisplayName(ctx.user);
        const message = await db.createMessage({
          chatRoomId: input.chatRoomId,
          senderId: ctx.user.id,
          senderName,
          content: input.content,
          replyToId: input.replyToId,
        });
        await db.addParticipant(input.chatRoomId, ctx.user.id);
        return message;
      }),
    getReplies: publicProcedure
      .input(z.object({
        messageId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getMessageWithReplies(input.messageId);
      }),
  }),

  tasks: router({
    list: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getTasksWithDetails(input.chatRoomId);
      }),
    myTasks: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getTasksByUser(ctx.user.id, input.status);
      }),
    allTasks: publicProcedure
      .input(z.object({
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAllTasks(input.status);
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        status: z.enum(["pending", "completed"]),
      }))
      .mutation(async ({ input }) => {
        return await db.updateTaskStatus(input.taskId, input.status);
      }),
    extractFromMessage: protectedProcedure
      .input(z.object({
        messageContent: z.string().max(5000, "Mensagem muito longa"),
        chatRoomId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get room participants to map mentioned names
        const participants = await db.getParticipants(input.chatRoomId);
        const participantNames = participants.map((p: any) => p.displayName).filter(Boolean) as string[];
        
        const extracted = await extractTasksFromMessage(
          input.messageContent,
          db.resolveUserDisplayName(ctx.user),
          true,
          participantNames
        );

        const createdTasks = [];
        for (const task of extracted) {
          if (task.isTask) {
            let dueDate: Date | undefined = undefined;
            if (task.dueDate) {
              try {
                const parsed = new Date(task.dueDate);
                if (!isNaN(parsed.getTime())) {
                  dueDate = parsed;
                }
              } catch (e) {
                // Invalid date format, skip
              }
            }
            
            const created = await db.createTask({
              messageId: 0,
              chatRoomId: input.chatRoomId,
              creatorId: ctx.user.id,
              assignedToId: undefined,
              assignedToName: task.assignedTo || db.resolveUserDisplayName(ctx.user),
              description: task.description,
              dueDate: dueDate,
              priority: task.priority,
              status: "pending",
              taskNumber: 0,
            });
            if (created) {
              createdTasks.push(created);
            }
          }
        }

        return createdTasks;
      }),
    interpretResponse: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        responseContent: z.string(),
        messageId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) {
          throw new Error("Task not found");
        }

        const update = await interpretResponseForTaskUpdate(
          task.description,
          input.responseContent,
          task.status,
          db.resolveUserDisplayName(ctx.user)
        );

        if (update && update.confidence > 0.5) {
          await db.updateTaskStatusAndResponse(
            input.taskId,
            update.newStatus,
            input.messageId
          );
          return { success: true, updated: true, newStatus: update.newStatus, reason: update.reason };
        }

        return { success: true, updated: false };
      }),
    detectCompletionInMessage: protectedProcedure
      .input(z.object({
        chatRoomId: z.number(),
        messageContent: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log("[ROUTER] detectCompletionInMessage called with:", { chatRoomId: input.chatRoomId, messageContent: input.messageContent });
        const allTasks = await db.getTasksWithDetails(input.chatRoomId);
        console.log("[ROUTER] Found tasks:", allTasks.length);
        if (allTasks.length === 0) {
          console.log("[ROUTER] No tasks found, returning empty");
          return { success: true, updated: [] };
        }

        const recentMessages = await db.getRecentMessagesContext(input.chatRoomId, 30);
        const contextStr = recentMessages
          .map((m: any) => `${m.senderId}: ${m.content}`)
          .join("\n");

        const detections = await detectTaskCompletionInMessage(
          input.messageContent,
          allTasks.map((t: any) => ({
            id: t.id,
            taskNumber: t.taskNumber,
            description: t.description,
            status: t.status,
          })),
          contextStr
        );

        console.log("[DETECT_COMPLETION] Detections received:", JSON.stringify(detections, null, 2));
        const updated = [];
        for (const detection of detections) {
          console.log("[DETECT_COMPLETION] Processing detection:", detection);
          if (detection.confidence >= 0.6) {
            console.log("[DETECT_COMPLETION] Confidence OK, looking for task number:", detection.taskNumber);
            const task = await db.getTaskByNumber(input.chatRoomId, detection.taskNumber);
            console.log("[DETECT_COMPLETION] Task found:", task);
            if (task) {
              console.log("[DETECT_COMPLETION] Updating task", task.id, "to status:", detection.newStatus);
              await db.updateTaskStatus(task.id, detection.newStatus);
              console.log("[DETECT_COMPLETION] Task updated successfully");
              updated.push({
                taskNumber: detection.taskNumber,
                newStatus: detection.newStatus,
                reason: detection.reason,
              });
            }
          }
        }

        console.log("[DETECT_COMPLETION] Final result:", { success: true, updated });
        return { success: true, updated };
      }),
    deleteTask: protectedProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) {
          throw new Error("Tarefa não encontrada");
        }
        
        // Delete the task
        await db.deleteTask(input.taskId);
        
        return { success: true, deletedTaskNumber: task.taskNumber };
      }),
    detectAssignmentInMessage: protectedProcedure
      .input(z.object({
        chatRoomId: z.number(),
        messageContent: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log("[ROUTER] detectAssignmentInMessage called with:", { chatRoomId: input.chatRoomId, messageContent: input.messageContent });
        const allTasks = await db.getTasksWithDetails(input.chatRoomId);
        console.log("[ROUTER] Found tasks:", allTasks.length);
        if (allTasks.length === 0) {
          console.log("[ROUTER] No tasks found, returning empty");
          return { success: true, updated: [] };
        }

        const recentMessages = await db.getRecentMessagesContext(input.chatRoomId, 30);
        const contextStr = recentMessages
          .map((m: any) => `${m.senderId}: ${m.content}`)
          .join("\n");

        const assignments = await detectTaskAssignmentInMessage(
          input.messageContent,
          allTasks.map((t: any) => ({
            id: t.id,
            taskNumber: t.taskNumber,
            description: t.description,
            assignedToName: t.assignedToName,
          })),
          contextStr
        );

        console.log("[ASSIGNMENT_DETECTOR] Assignments received:", JSON.stringify(assignments, null, 2));
        const updated = [];

        for (const assignment of assignments) {
          console.log("[ASSIGNMENT_DETECTOR] Processing assignment:", assignment);
          if (assignment.confidence >= 0.6 && assignment.taskNumber && assignment.assignedTo) {
            console.log("[ASSIGNMENT_DETECTOR] Confidence OK, looking for task number:", assignment.taskNumber);
            const task = await db.getTaskByNumber(input.chatRoomId, assignment.taskNumber);
            console.log("[ASSIGNMENT_DETECTOR] Task found:", task);
            if (task) {
              const participants = await db.getParticipants(input.chatRoomId);
              console.log("[ASSIGNMENT_DETECTOR] Participants:", participants.map((p: any) => p.displayName));
              
              const participantList = participants.map((p: any) => ({ name: p.displayName || p.userName }));
              console.log("[ASSIGNMENT_DETECTOR] Matching:", assignment.assignedTo, "against", participantList);
              
              const matchedParticipant = findByNormalizedName(participantList, assignment.assignedTo);
              console.log("[ASSIGNMENT_DETECTOR] Matched:", matchedParticipant);
              
              const originalName = matchedParticipant?.name || assignment.assignedTo;
              console.log("[ASSIGNMENT_DETECTOR] Final name:", originalName);
              await db.updateTaskAssignee(task.id, originalName);
              console.log("[ASSIGNMENT_DETECTOR] Task updated successfully");
              updated.push({
                taskNumber: assignment.taskNumber,
                assignedTo: originalName,
                reason: assignment.reason,
              });
            }
          }
        }

        console.log("[ASSIGNMENT_DETECTOR] Final result:", { success: true, updated });
        return { success: true, updated };
      }),
    validateParticipantNames: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const participants = await db.getParticipants(input.chatRoomId);
        const participantNames = getUniqueParticipantNames(participants);
        
        const report = await validateAndFixRoomTasks(input.chatRoomId, participantNames);
        return report;
      }),
    getNameVariations: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getParticipantNameVariations(input.chatRoomId);
      }),
    cleanupAllParticipantNames: publicProcedure
      .mutation(async () => {
        const rooms = await db.getChatRooms();
        const allReports = [];
        let totalCorrected = 0;
        let totalInvalid = 0;

        for (const room of rooms) {
          const participants = await db.getParticipants(room.id);
          const participantNames = getUniqueParticipantNames(participants);
          
          const report = await validateAndFixRoomTasks(room.id, participantNames);
          
          allReports.push({
            roomId: room.id,
            roomName: room.name,
            ...report,
          });
          
          totalCorrected += report.correctedTasks;
          totalInvalid += report.invalidTasks;
          
          console.log(`[CLEANUP] Room "${room.name}": ${report.correctedTasks} corrected, ${report.invalidTasks} invalid`);
        }

        return {
          success: true,
          totalRooms: rooms.length,
          totalCorrected,
          totalInvalid,
          reports: allReports,
        };
      }),
    debugExtraction: publicProcedure
      .input(z.object({
        messageContent: z.string(),
        chatRoomId: z.number(),
      }))
      .query(async ({ input }) => {
        const participants = await db.getParticipants(input.chatRoomId);
        const participantNames = participants.map((p: any) => p.displayName).filter(Boolean) as string[];
        
        const extracted = await extractTasksFromMessage(
          input.messageContent,
          "Debug User",
          true,
          participantNames
        );
        
        return {
          input: { messageContent: input.messageContent, participantNames },
          output: extracted,
        };
      }),
    debugAssignment: publicProcedure
      .input(z.object({
        messageContent: z.string(),
        chatRoomId: z.number(),
      }))
      .query(async ({ input }) => {
        const allTasks = await db.getTasksWithDetails(input.chatRoomId);
        const participants = await db.getParticipants(input.chatRoomId);
        
        const assignments = await detectTaskAssignmentInMessage(
          input.messageContent,
          allTasks.map((t: any) => ({
            id: t.id,
            taskNumber: t.taskNumber,
            description: t.description,
            assignedToName: t.assignedToName,
          })),
          ""
        );
        
        return {
          messageContent: input.messageContent,
          assignments,
          participants: participants.map((p: any) => ({ displayName: p.displayName, userName: p.userName })),
        };
      }),
    updateDescription: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        description: z.string().min(1).max(2000, "Descrição muito longa"),
      }))
      .mutation(async ({ input }) => {
        return await db.updateTaskDescription(input.taskId, input.description);
      }),
  }),

  // Weekly Summary
  summary: router({
    generate: publicProcedure
      .input(z.object({
        chatRoomId: z.number(),
        weekStart: z.date().optional(),
        weekEnd: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        // Calculate week dates if not provided
        let weekStart = input.weekStart;
        let weekEnd = input.weekEnd;
        
        if (!weekStart || !weekEnd) {
          const now = new Date();
          // Get last Monday
          const lastMonday = new Date(now);
          lastMonday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
          lastMonday.setHours(0, 0, 0, 0);
          
          // Get last Sunday
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          lastSunday.setHours(23, 59, 59, 999);
          
          weekStart = weekStart || lastMonday;
          weekEnd = weekEnd || lastSunday;
        }
        
        // Get room info
        const room = await db.getChatRoomById(input.chatRoomId);
        if (!room) {
          throw new Error("Sala não encontrada");
        }
        
        // Get tasks for the week
        const tasks = await db.getTasksForSummary(input.chatRoomId, weekStart, weekEnd);
        
        // Calculate summary data
        const summaryData = calculateWeeklySummaryData(
          tasks,
          room.name,
          weekStart,
          weekEnd
        );
        
        // Generate summary with AI
        const summary = await generateWeeklySummary(summaryData);
        
        return {
          success: true,
          summary,
          stats: {
            totalTasks: summaryData.totalTasks,
            completedTasks: summaryData.completedTasks,
            pendingTasks: summaryData.pendingTasks,
            completionRate: summaryData.completionRate,
            overdueTasks: summaryData.overdueTasks,
          },
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
