import { findBestParticipantMatch, normalizeForComparison } from "./participant-name-matcher";
import * as db from "./db";

/**
 * Validate and fix a task's assigned person name
 * Ensures the name exactly matches a participant in the room
 */
export async function validateTaskAssignedPerson(
  task: any,
  roomParticipants: string[]
): Promise<{ isValid: boolean; correctedName?: string; reason?: string }> {
  if (!task.assignedToName) {
    return { isValid: true, reason: "No assigned person" };
  }

  // Check if the current name exactly matches a participant
  const exactMatch = roomParticipants.find(p => 
    normalizeForComparison(p) === normalizeForComparison(task.assignedToName)
  );

  if (exactMatch) {
    // If the name matches exactly (ignoring case/accents), it's valid
    if (exactMatch === task.assignedToName) {
      return { isValid: true, reason: "Exact match" };
    } else {
      // Name matches but with different case/accents - should be corrected
      return { 
        isValid: false, 
        correctedName: exactMatch,
        reason: "Case/accent mismatch" 
      };
    }
  }

  // Try to find a better match
  const bestMatch = await findBestParticipantMatch(task.assignedToName, roomParticipants);
  
  if (bestMatch) {
    return { 
      isValid: false, 
      correctedName: bestMatch,
      reason: "Fuzzy match found" 
    };
  }

  // No match found
  return { 
    isValid: false, 
    reason: `No participant found matching "${task.assignedToName}"` 
  };
}

/**
 * Validate and fix all tasks in a room
 * Returns a report of changes made
 */
export async function validateAndFixRoomTasks(
  roomId: number,
  roomParticipants: string[]
): Promise<{
  totalTasks: number;
  validTasks: number;
  correctedTasks: number;
  invalidTasks: number;
  corrections: Array<{
    taskId: number;
    oldName: string;
    newName: string;
    reason: string;
  }>;
}> {
  const tasks = await db.getTasksByChatRoom(roomId);
  
  const report = {
    totalTasks: tasks.length,
    validTasks: 0,
    correctedTasks: 0,
    invalidTasks: 0,
    corrections: [] as Array<{
      taskId: number;
      oldName: string;
      newName: string;
      reason: string;
    }>,
  };

  for (const task of tasks) {
    const validation = await validateTaskAssignedPerson(task, roomParticipants);

    if (validation.isValid) {
      report.validTasks++;
    } else if (validation.correctedName) {
      report.correctedTasks++;
      report.corrections.push({
        taskId: task.id,
        oldName: task.assignedToName || "unassigned",
        newName: validation.correctedName,
        reason: validation.reason || "Corrected",
      });

      // Update the task in the database
      await db.updateTaskAssignee(task.id, validation.correctedName);
    } else {
      report.invalidTasks++;
    }
  }

  return report;
}

/**
 * Get a summary of participant name variations in tasks
 * Useful for identifying inconsistencies
 */
export async function getParticipantNameVariations(
  roomId: number
): Promise<Record<string, string[]>> {
  const tasks = await db.getTasksByChatRoom(roomId);
  const variations: Record<string, string[]> = {};

  for (const task of tasks) {
    if (!task.assignedToName) continue;

    const normalized = normalizeForComparison(task.assignedToName);
    if (!variations[normalized]) {
      variations[normalized] = [];
    }

    if (!variations[normalized].includes(task.assignedToName)) {
      variations[normalized].push(task.assignedToName);
    }
  }

  return variations;
}
