import { invokeLLM } from "./_core/llm";
import { resolveTaskAssignee } from "./assignee-from-message";

// Dicionário de correções ortográficas comuns em português do Brasil
const PORTUGUESE_CORRECTIONS: Record<string, string> = {
  "tarefá": "tarefa",
  "responsavel": "responsável",
  "descricao": "descrição",
  "reuniao": "reunião",
  "notificacao": "notificação",
  "comunicaçao": "comunicação",
  "apresentaçao": "apresentação",
  "revisao": "revisão",
  "implementaçao": "implementação",
  "correçao": "correção",
  "organizaçao": "organização",
  "atribuiçao": "atribuição",
  "conclusao": "conclusão",
};

export interface ExtractedTask {
  description: string;
  assignedTo?: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
  isTask: boolean;
}

// Função para corrigir ortografia em português do Brasil usando LLM
async function correctPortugueseSpellingWithLLM(text: string): Promise<string> {
  if (!text || text.length < 10) {
    // Para textos muito curtos, usar apenas correção básica
    return correctPortugueseSpellingBasic(text);
  }
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a Portuguese (Brazil) spelling and grammar correction expert. 
          
Your task is to:
1. Correct spelling errors
2. Fix grammar issues
3. Improve punctuation
4. Ensure proper capitalization
5. Maintain the original meaning and tone
6. CRITICAL: Keep the text COMPLETE and detailed - do NOT summarize, shorten, or condense the original content
7. Preserve ALL information from the original text - every detail must remain
8. Only fix spelling and grammar, never remove or summarize content

Return ONLY the corrected text, nothing else. No explanations or markdown.`,
        },
        {
          role: "user",
          content: `Correct this Portuguese text for spelling, grammar, and clarity. DO NOT summarize or shorten the text - keep ALL original information complete:

"${text}"`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (typeof content === 'string') {
      return content.trim();
    }
    return text;
  } catch (error) {
    console.error("Error correcting spelling with LLM:", error);
    // Fallback to basic correction
    return correctPortugueseSpellingBasic(text);
  }
}

// Função básica para correção rápida (fallback)
function correctPortugueseSpellingBasic(text: string): string {
  if (!text) return text;
  
  let corrected = text;
  
  // Aplicar correções do dicionário (case-insensitive)
  for (const [incorrect, correct] of Object.entries(PORTUGUESE_CORRECTIONS)) {
    const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
    corrected = corrected.replace(regex, correct);
  }
  
  // Correções adicionais de padrões comuns
  // Espaços múltiplos
  corrected = corrected.replace(/\s+/g, ' ').trim();
  
  // Capitalizar primeira letra após pontuação
  corrected = corrected.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
    return punct + ' ' + letter.toUpperCase();
  });
  
  // Capitalizar primeira letra da string
  corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  
  return corrected;
}

// Função para normalizar strings para comparação
function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

export async function extractTasksFromMessage(
  messageContent: string,
  senderName: string,
  enableSpellingCorrection: boolean = true,
  roomParticipants: string[] = []
): Promise<ExtractedTask[]> {
  try {
    const originalMessage = (messageContent || "").trim();
    if (!originalMessage) return [];

    // Description policy: always the FULL chat message (with spelling fixes), never a LLM summary.
    const fullCorrectedDescription = enableSpellingCorrection
      ? await correctPortugueseSpellingWithLLM(originalMessage)
      : correctPortugueseSpellingBasic(originalMessage);

    const rosterText = roomParticipants.length
      ? roomParticipants.join(" | ")
      : "(no roster)";
    const rosterCsv = roomParticipants.length
      ? roomParticipants.join(", ")
      : "(none)";

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task extraction AI. Analyze ONE chat message and decide if it is a single actionable task.

Return JSON:
{
  "tasks": [
    {
      "description": "ignored by server — leave any short placeholder",
      "assignedTo": "Name of person responsible (if mentioned)",
      "dueDate": "Due date if mentioned (e.g., 'tomorrow', 'next Friday', 'by end of week')",
      "priority": "low|medium|high based on context",
      "isTask": true
    }
  ]
}

If the message is NOT a task, return: { "tasks": [] }

CRITICAL — ONE TASK PER MESSAGE:
- Return at most ONE item in "tasks". Never split one message into multiple tasks.
- Even if the message lists several actions, treat it as a single task for the whole message.

CRITICAL RULES FOR TASK DETECTION:
- DO NOT create tasks from QUESTIONS. If the message is a question (contains "?" especially at the end), set isTask to false / return empty tasks. Questions are NOT tasks.
- Examples of QUESTIONS (not tasks): "Alguém pode enviar o relatório?", "Quando vai estar pronto?", "Você conseguiu fazer?", "Podemos marcar reunião?"
- Examples of TASKS: "Preciso que envie o relatório até sexta", "Maria deve preparar a apresentação", "Victor, elaborar os desenhos de drenagem"
- Only extract clear action items, requests, or commands - NOT questions, chit-chat, or status-only notes

ASSIGNEE RULES (very important):
- Prefer names at START of message: "Victor, ...", "Victor:", "@Victor ...", "Victor precisa ...", "Victor deve ..."
- Also: "para Victor ...", "Victor tem que ..."
- When a person is named that way, assignedTo MUST be that person — NEVER the sender just because they wrote the message.
- If someone addresses another participant, that other participant is the assignee.
- Only use the SENDER as assignedTo when NO other person is clearly the owner of the action.
- Prefer exact names from this room roster when possible: ${rosterText}
- Preserve capitalization of names; do not lowercase them.

Guidelines:
- Look for keywords like: need, should, must, please, can you, could you, by, until, deadline, etc.
- Portuguese keywords: precisa, deve, tem que, por favor, pode, poderia, ate, prazo, entregar, fazer, enviar, elaborar
- Infer priority from context (urgent, ASAP, URGENTE = high; normal = medium; nice to have = low)
- Extract dates from natural language like "by Friday", "tomorrow", "ate sexta", "proxima semana"
- The server will REPLACE description with the full original message (spell-corrected). You may put a short placeholder in description.`,
        },
        {
          role: "user",
          content: `Analyze this single message (at most one task):\n\n"${originalMessage}"\n\nSender (only the author of the chat bubble — not automatically the assignee): ${senderName}\nRoom participants: ${rosterCsv}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    assignedTo: { type: "string" },
                    dueDate: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    isTask: { type: "boolean" },
                  },
                  required: ["description", "priority", "isTask"],
                },
              },
            },
            required: ["tasks"],
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
    const tasks = (parsed.tasks || []) as ExtractedTask[];
    console.log("[LLM_EXTRACTION] Raw LLM response:", { messageContent: originalMessage, tasks });

    // Hard limit: never more than one task per chat message
    const candidate = tasks.find((t) => t && t.isTask) || tasks[0];
    if (!candidate || candidate.isTask === false) {
      return [];
    }

    // LOCAL patterns beat LLM (Victor, @Larissa, Sérgio precisa...)
    const resolved = await resolveTaskAssignee({
      messageContent: originalMessage,
      llmAssignedTo: candidate.assignedTo,
      senderName,
      roomParticipants,
    });
    console.log("[TASK_EXTRACTOR] Assignee resolved:", resolved);

    const singleTask: ExtractedTask = {
      ...candidate,
      isTask: true,
      // Always store 100% of the (corrected) chat message as the task description
      description: fullCorrectedDescription || originalMessage,
      assignedTo: resolved.assignedTo || senderName,
      priority: candidate.priority || "medium",
    };

    console.log("[TASK_EXTRACTOR] Final single task:", {
      descriptionLength: singleTask.description.length,
      assignedTo: singleTask.assignedTo,
      assigneeSource: resolved.source,
    });

    return [singleTask];
  } catch (error) {
    console.error("Error extracting tasks from message:", error);
    return [];
  }
}
