import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { generateWeeklySummary, calculateWeeklySummaryData } from "./weekly-summary-generator";
import { getPreviousSundayRange } from "../shared/weekRange";

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
        // Scheduled reports use the same previous-Sunday-to-request-time window.
        const { start: lastSunday, end: reportEnd } = getPreviousSundayRange();

        // Get tasks for the week
        const tasks = await db.getTasksForSummary(room.id, lastSunday, reportEnd);
        
        if (tasks.length === 0) {
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
          lastSunday,
          reportEnd
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


        results.push({
          roomId: room.id,
          roomName: room.name,
          status: "success",
          taskCount: tasks.length,
          completedCount: summaryData.completedTasks,
          pendingCount: summaryData.pendingTasks,
        });
      } catch (error) {
        results.push({
          roomId: room.id,
          roomName: room.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(`[WEEKLY_SUMMARY_SCHEDULE] Completed: ${results.length} rooms processed`);
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      roomsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("[WEEKLY_SUMMARY_SCHEDULE] Fatal error", error instanceof Error ? error.name : "unknown");
    res.status(500).json({
      error: "Erro interno ao processar o relatório semanal",
    });
  }
}
