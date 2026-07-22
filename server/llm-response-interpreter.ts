import { invokeLLM } from "./_core/llm";

export interface TaskStatusUpdate {
  taskId: number;
  newStatus: "pending" | "completed";
  confidence: number; // 0-1
  reason: string;
}

export async function interpretResponseForTaskUpdate(
  originalTaskDescription: string,
  responseContent: string,
  currentStatus: string,
  responderName: string
): Promise<TaskStatusUpdate | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task status interpreter. Analyze a response message to determine if it indicates progress or completion of a task.

Given:
1. The original task description
2. A response message
3. The current task status

Return a JSON object indicating whether the task status should be updated:
{
  "shouldUpdate": boolean,
  "newStatus": "pending|completed|cancelled",
  "confidence": 0-1,
  "reason": "explanation of why this status change"
}

Guidelines:
- "completed": Response indicates task is done (words like: done, finished, completed, ready, deployed, sent, concluida, pronta, feita, enviada, finalizada, etc.)
- "cancelled": Response indicates task won't be done (words like: cancelled, won't do, not needed, postponed indefinitely, cancelada, nao sera feita, adiada indefinidamente, etc.)
- "pending": No clear indication of completion
- IMPORTANT: Also detect when a task marked as completed is actually NOT completed (e.g., "task was not completed", "tarefa nao foi concluida")
- Only update if there's clear indication in the response
- Set confidence high (0.8-1.0) for clear statements, medium (0.5-0.7) for implied statements
- If unclear, return shouldUpdate: false
- Consider context: if user says "I couldn't finish it", mark as pending, not completed`,
        },
        {
          role: "user",
          content: `Task: "${originalTaskDescription}"
Current Status: ${currentStatus}
Response: "${responseContent}"
Responder: ${responderName}

Analyze if this response indicates a status change for the task.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_status_update",
          strict: true,
          schema: {
            type: "object",
            properties: {
              shouldUpdate: { type: "boolean" },
              newStatus: {
                type: "string",
                enum: ["pending", "completed"],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" },
            },
            required: ["shouldUpdate", "newStatus", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) return null;

    let jsonContent: string;
    if (typeof content === 'string') {
      jsonContent = content;
    } else if (Array.isArray(content)) {
      const textItem = (content as any[]).find((c: any) => c.type === 'text') as any;
      if (!textItem || !textItem.text) return null;
      jsonContent = textItem.text;
    } else {
      return null;
    }

    const parsed = JSON.parse(jsonContent);
    
    if (!parsed.shouldUpdate) {
      return null;
    }

    return {
      taskId: 0, // Will be set by caller
      newStatus: parsed.newStatus,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch (error) {
    console.error("Error interpreting response for task update:", error);
    return null;
  }
}
