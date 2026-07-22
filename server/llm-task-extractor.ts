import { invokeLLM } from "./_core/llm";
import { findBestParticipantMatch } from "./participant-name-matcher";

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
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task extraction AI. Analyze the given message and extract any tasks or action items mentioned.
          
For each task found, return a JSON array with the following structure:
{
  "tasks": [
    {
      "description": "What needs to be done",
      "assignedTo": "Name of person responsible (if mentioned)",
      "dueDate": "Due date if mentioned (e.g., 'tomorrow', 'next Friday', 'by end of week')",
      "priority": "low|medium|high based on context",
      "isTask": true
    }
  ]
}

If no tasks are found, return: { "tasks": [] }

CRITICAL RULES FOR TASK DETECTION:
- DO NOT create tasks from QUESTIONS. If the message is a question (contains "?" especially at the end), set isTask to false. Questions are NOT tasks.
- Examples of QUESTIONS (isTask: false): "Alguém pode enviar o relatório?", "Quando vai estar pronto?", "Você conseguiu fazer?", "Podemos marcar reunião?"
- Examples of TASKS (isTask: true): "Preciso que envie o relatório até sexta", "Maria deve preparar a apresentação", "Fazer revisão do documento"
- Only extract clear action items, requests, or commands - NOT questions or inquiries

Guidelines:
- Only extract clear action items or requests
- Look for keywords like: need, should, must, please, can you, could you, by, until, deadline, etc.
- Portuguese keywords: precisa, deve, tem que, por favor, pode, poderia, ate, prazo, entregar, fazer, enviar
- Infer priority from context (urgent, ASAP, URGENTE = high; normal = medium; nice to have = low)
- Extract assigned person from mentions like "@name" or "for John" or "John needs to" or "John deve fazer"
- Extract dates from natural language like "by Friday", "next week", "tomorrow", "by EOD", "ate sexta", "proxima semana"
- IMPORTANT: Do NOT include # symbols in task descriptions. Remove any # from the beginning or middle of descriptions.
- Format descriptions clearly without special prefixes like # or Task numbers

CRITICAL RULES FOR TASK DESCRIPTIONS:
- The description MUST be COMPLETE and DETAILED - never summarize or shorten the task description
- Include ALL relevant information from the original message in the description
- The description should capture the full context of what needs to be done, not just a brief summary
- Example BAD (too short): "Enviar relatório"
- Example GOOD (complete): "Enviar o relatório financeiro do mês de julho para o departamento de contabilidade até sexta-feira"
- Preserve all details: what, when, where, who, how, and any specific requirements mentioned
- Do NOT use vague or generic descriptions - be specific and thorough
- The description should be self-contained - someone reading just the description should understand exactly what needs to be done
- CRITICAL: Do NOT include the responsible person name in the task description. The person name should ONLY go in the assignedTo field, never inside the description text. Example: if message is "João needs to send the financial report by Friday", description should be "Send the financial report by Friday" (NOT "João needs to send the financial report by Friday"), and assignedTo should be "João"
- Ensure descriptions are clear and actionable
- Only set isTask to true if it's a clear action item, not a statement or question
- CRITICAL: If no responsible person is clearly identified in the message, set assignedTo to the SENDER name (the person who sent the message). Every task MUST have a responsible person - never leave assignedTo empty or undefined. When in doubt about who is responsible, default to the sender.
- The assignedTo field must ALWAYS have a value. If the message says "I need to do X" or "Need to finish Y" without mentioning another person, the sender is the responsible person.
- CRITICAL: For assignedTo field, preserve the EXACT capitalization of person names as they appear in the message. Do NOT convert names to lowercase. Examples: \"John\", \"Maria\", \"Sergio\", not \"john\", \"maria\", \"sergio\"`,
        },
        {
          role: "user",
          content: `Extract tasks from this message:\n\n"${messageContent}"\n\nSender: ${senderName}`,
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
    if (typeof content === 'string') {
      jsonContent = content;
    } else if (Array.isArray(content)) {
      const textItem = (content as any[]).find((c: any) => c.type === 'text') as any;
      if (!textItem || !textItem.text) return [];
      jsonContent = textItem.text;
    } else {
      return [];
    }

    const parsed = JSON.parse(jsonContent);
    const tasks = parsed.tasks || [];
    console.log("[LLM_EXTRACTION] Raw LLM response:", { messageContent, tasks });
    
    // Aplicar mapeamento de participantes PRIMEIRO, depois correção ortográfica
    if (enableSpellingCorrection || roomParticipants.length > 0) {
      return await Promise.all(
        tasks.map(async (task: ExtractedTask) => {
          let correctedDescription = task.description;
          let mappedAssignedTo = task.assignedTo;
          
          // PASSO 1: Mapear nome mencionado para nome real do participante ANTES de qualquer correção
          // Nomes de pessoas NAO devem ser corrigidos ortograficamente
          console.log("[TASK_EXTRACTOR] Processing task:", { description: task.description, assignedTo: task.assignedTo, roomParticipantsCount: roomParticipants.length });
          if (mappedAssignedTo && roomParticipants.length > 0) {
            console.log("[TASK_EXTRACTOR] Attempting to match:", { mappedAssignedTo, roomParticipants });
            const bestMatch = await findBestParticipantMatch(mappedAssignedTo, roomParticipants);
            console.log("[TASK_EXTRACTOR] Match result:", { mappedAssignedTo, bestMatch });
            if (bestMatch) {
              mappedAssignedTo = bestMatch; // Use o nome exato da lista de participantes
            } else {
              // Se nao encontrar match, deixar como undefined para que seja tratado depois
              mappedAssignedTo = undefined;
            }
          } else {
            console.log("[TASK_EXTRACTOR] No assigned person or no participants", { mappedAssignedTo, participantsLength: roomParticipants.length });
          }
          
          // PASSO 2: Corrigir ortografia APENAS da descricao, nunca do nome
          if (enableSpellingCorrection) {
            correctedDescription = await correctPortugueseSpellingWithLLM(task.description);
            // NAO corrigir o nome do responsavel - ele ja foi mapeado para o nome exato
          }
          
          return {
            ...task,
            description: correctedDescription,
            assignedTo: mappedAssignedTo,
          };
        })
      );
    }
    
    return tasks;
  } catch (error) {
    console.error("Error extracting tasks from message:", error);
    return [];
  }
}
