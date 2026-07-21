import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { generateWeeklySummary, calculateWeeklySummaryData } from "./weekly-summary-generator";

export async function handleWeeklySummarySchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    
    // Verify this is a cron request
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[WEEKLY_SUMMARY_SCHEDULE] Starting scheduled summary generation");

    // Get all chat rooms
    const rooms = await db.getChatRooms();
    console.log(`[WEEKLY_SUMMARY_SCHEDULE] Found ${rooms.length} rooms`);

    const results = [];

    // Generate summary for each room
    for (const room of rooms) {
      try {
        // Calculate week dates (last Monday to last Sunday)
        const now = new Date();
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        lastMonday.setHours(0, 0, 0, 0);

        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        lastSunday.setHours(23, 59, 59, 999);

        // Get tasks for the week
        const tasks = await db.getTasksForSummary(room.id, lastMonday, lastSunday);
        
        if (tasks.length === 0) {
          console.log(`[WEEKLY_SUMMARY_SCHEDULE] No tasks for room ${room.name}, skipping`);
          results.push({
            roomId: room.id,
            roomName: room.name,
            status: "skipped",
            reason: "no_tasks",
          });
          continue;
        }

        // Calculate summary data
        const summaryData = calculateWeeklySummaryData(
          tasks,
          room.name,
          lastMonday,
          lastSunday
        );

        // Generate summary with AI
        const summary = await generateWeeklySummary(summaryData);

        // Send summary as message to the room
        const messageContent = `📊 **RESUMO SEMANAL**\n\n${summary}`;
        
        await db.createMessage({
          chatRoomId: room.id,
          senderId: user.id || 1, // Use cron user ID or default
          content: messageContent,
        });

        console.log(`[WEEKLY_SUMMARY_SCHEDULE] Summary sent to room ${room.name}`);

        results.push({
          roomId: room.id,
          roomName: room.name,
          status: "success",
          taskCount: tasks.length,
          completedCount: summaryData.completedTasks,
          pendingCount: summaryData.pendingTasks,
        });
      } catch (error) {
        console.error(`[WEEKLY_SUMMARY_SCHEDULE] Error for room ${room.name}:`, error);
        results.push({
          roomId: room.id,
          roomName: room.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("[WEEKLY_SUMMARY_SCHEDULE] Completed", results);
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      roomsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("[WEEKLY_SUMMARY_SCHEDULE] Fatal error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        url: req.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
