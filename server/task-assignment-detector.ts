import { invokeLLM } from "./_core/llm";
import { normalizeName } from "../shared/normalizeNames";

interface AssignmentDetection {
  isAssignment: boolean;
  taskNumber?: number;
  assignedTo?: string;
  reason?: string;
  confidence: number;
}

export async function detectTaskAssignmentInMessage(
  messageContent: string,
  allTasks: Array<{ id: number; taskNumber: number; description: string; assignedToName?: string }>,
  contextStr: string
): Promise<AssignmentDetection[]> {
  console.log("[ASSIGNMENT_DETECTOR] Analyzing message:", messageContent);

  const tasksSummary = allTasks
    .map((t) => `Task ${t.taskNumber}: "${t.description}" (currently assigned to: ${t.assignedToName || "nobody"})`)
    .join("\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task assignment detector. Analyze a chat message to detect if any tasks are being assigned or reassigned to someone.

Given:
1. A list of active tasks with their numbers and current assignees
2. A new message from the chat
3. Recent conversation context

Return a JSON array of detected task assignments.

Return format:
[
  {
    "taskNumber": 1,
    "assignedTo": "John",
    "confidence": 0.9,
    "reason": "User explicitly assigned task 1 to John"
  }
]

Guidelines:
- Look for patterns like "@name Task X", "assign task X to name", "Task X for name", "reassign task X to name"
- Look for explicit mentions like "task 1 for John", "tarefa 2 para Maria", "3 to Carlos"
- Portuguese keywords: atribuir, designar, responsável, para, a
- English keywords: assign, assign to, for, to, responsible for
- Set confidence high (0.8-1.0) for explicit mentions
- Set confidence medium (0.6-0.7) for implicit indicators
- Only return tasks with clear assignment indicators
- If no tasks are assigned or unclear, return empty array
- CRITICAL: For assignedTo field, preserve the EXACT capitalization of person names as they appear in the message. Do NOT convert names to lowercase.`,
        },
        {
          role: "user",
          content: `Active Tasks:
${tasksSummary}

Recent Conversation Context:
${contextStr}

New Message to Analyze:
"${messageContent}"

Detect any task assignments indicated in this message.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_assignments",
          strict: true,
          schema: {
            type: "object",
            properties: {
              assignments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskNumber: { type: "number" },
                    assignedTo: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reason: { type: "string" },
                  },
                  required: ["taskNumber", "assignedTo", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["assignments"],
            additionalProperties: false,
          },
        },
      },
    });

    console.log("[ASSIGNMENT_DETECTOR] LLM Response:", response);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.log("[ASSIGNMENT_DETECTOR] No content in response");
      return [];
    }

    let jsonContent: string;
    if (typeof content === "string") {
      jsonContent = content;
    } else if (Array.isArray(content)) {
      const textItem = content.find((c: any) => c.type === "text") as any;
      if (!textItem || !textItem.text) {
        console.log("[ASSIGNMENT_DETECTOR] No text in content array");
        return [];
      }
      jsonContent = textItem.text;
    } else {
      console.log("[ASSIGNMENT_DETECTOR] Invalid content type");
      return [];
    }

    const parsed = JSON.parse(jsonContent);
    console.log("[ASSIGNMENT_DETECTOR] Parsed response:", JSON.stringify(parsed, null, 2));

    const assignments = parsed.assignments || parsed;
    if (!Array.isArray(assignments)) {
      console.log("[ASSIGNMENT_DETECTOR] Response is not an array");
      return [];
    }

    // Filter for high confidence detections
    const filtered = assignments.filter(
      (item: any) =>
        item.confidence >= 0.6 &&
        item.taskNumber &&
        item.assignedTo
    );
    console.log("[ASSIGNMENT_DETECTOR] Filtered assignments (confidence >= 0.6):", JSON.stringify(filtered, null, 2));

    return filtered.map((a: any) => ({
      isAssignment: true,
      taskNumber: Number(a.taskNumber),
      assignedTo: String(a.assignedTo), // Keep original name from LLM for matching
      confidence: a.confidence,
      reason: a.reason,
    }));
  } catch (error) {
    console.error("[ASSIGNMENT_DETECTOR] Error:", error);
    return [];
  }
}
