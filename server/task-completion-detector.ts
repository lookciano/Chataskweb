import { invokeLLM } from "./_core/llm";

export interface TaskCompletionDetection {
  taskNumber: number;
  detected: boolean;
  newStatus: "pending" | "completed";
  confidence: number;
  reason: string;
}

export async function detectTaskCompletionInMessage(
  messageContent: string,
  allTasks: Array<{
    id: number;
    taskNumber: number;
    description: string;
    status: string;
  }>,
  conversationContext: string
): Promise<TaskCompletionDetection[]> {
  console.log("[TASK_COMPLETION_DETECTOR] Starting detection");
  console.log("[TASK_COMPLETION_DETECTOR] Message:", messageContent);
  console.log("[TASK_COMPLETION_DETECTOR] Tasks count:", allTasks.length);
  if (allTasks.length === 0) {
    console.log("[TASK_COMPLETION_DETECTOR] No tasks to check");
    return [];
  }

  try {
    // Criar um sumário das tarefas
    const tasksSummary = allTasks
      .map(
        (t) =>
          `Task ${t.taskNumber}: "${t.description}" (current status: ${t.status})`
      )
      .join("\n");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task completion detector. Analyze a chat message to detect if any tasks have been completed, are in progress, or cancelled.

Given:
1. A list of active tasks with their numbers
2. A new message from the chat
3. Recent conversation context

Return a JSON array of detected task updates. Only include tasks that have clear indicators of status change.

Return format:
[
  {
    "taskNumber": 1,
    "detected": true,
    "newStatus": "completed|pending|cancelled",
    "confidence": 0.9,
    "reason": "User explicitly said task 1 is done"
  }
]

Guidelines:
- Look for explicit mentions like "task 1 completed", "tarefa 2 pronta", "3 done"
- Look for implicit indicators: "I finished the 1", "just sent 2", "working on 3"
- IMPORTANT: Also detect NOT COMPLETED indicators like "task 1 was not completed", "tarefa 2 nao foi concluida", "3 failed"
- Portuguese keywords (COMPLETED): concluida, pronta, feita, enviada, finalizada, completa, comecada, iniciada
- Portuguese keywords (NOT COMPLETED): nao foi concluida, nao foi feita, nao foi enviada, falhou, nao funcionou
- English keywords (COMPLETED): completed, done, finished, ready, sent, deployed, started, working
- English keywords (NOT COMPLETED): not completed, not done, not finished, failed, didn't work, couldn't
- Keywords for cancellation: cancelled, won't do, not needed, postponed indefinitely, cancelada, nao sera feita
- Set confidence high (0.8-1.0) for explicit mentions
- Set confidence medium (0.6-0.7) for implicit indicators
- Only return tasks with clear indicators
- If no tasks are mentioned or unclear, return empty array`,
        },
        {
          role: "user",
          content: `Active Tasks:
${tasksSummary}

Recent Conversation Context:
${conversationContext}

New Message to Analyze:
"${messageContent}"

Detect any task status changes indicated in this message.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_completions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              completions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskNumber: { type: "number" },
                    detected: { type: "boolean" },
                    newStatus: {
                      type: "string",
                      enum: ["pending", "completed"],
                    },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reason: { type: "string" },
                  },
                  required: ["taskNumber", "detected", "newStatus", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["completions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) return [];

    let jsonContent: string;
    if (typeof content === "string") {
      jsonContent = content;
    } else if (Array.isArray(content)) {
      const textItem = (content as any[]).find((c: any) => c.type === "text") as any;
      if (!textItem || !textItem.text) return [];
      jsonContent = textItem.text;
    } else {
      return [];
    }

    const parsed = JSON.parse(jsonContent);
    console.log("[TASK_COMPLETION_DETECTOR] LLM Response parsed:", JSON.stringify(parsed, null, 2));
    const completions = parsed.completions || parsed;
    if (!Array.isArray(completions)) {
      console.log("[TASK_COMPLETION_DETECTOR] Response is not an array");
      return [];
    }

    // Filter for high confidence detections
    const filtered = completions.filter(
      (item: any) =>
        item.detected &&
        item.confidence >= 0.6 &&
        item.taskNumber &&
        item.newStatus
    );
    console.log("[TASK_COMPLETION_DETECTOR] Filtered detections (confidence >= 0.6):", JSON.stringify(filtered, null, 2));
    return filtered;
  } catch (error) {
    console.error("Error detecting task completion:", error);
    return [];
  }
}
