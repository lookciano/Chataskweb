import { invokeLLM } from "./_core/llm";

export interface WeeklySummaryData {
  roomName: string;
  weekStart: Date;
  weekEnd: Date;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  overdueTasks: number;
  tasksByResponsible: Record<string, { total: number; completed: number }>;
  topResponsibles: Array<{ name: string; completed: number; total: number }>;
}

export async function generateWeeklySummary(data: WeeklySummaryData): Promise<string> {
  const prompt = buildSummaryPrompt(data);

  try {
    const response = await invokeLLM({
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
    });

    // Extract text from response
    let summaryText = "";
    if (typeof response === "string") {
      summaryText = response;
    } else if (response.choices && response.choices[0]) {
      const content = response.choices[0].message?.content;
      if (Array.isArray(content)) {
        summaryText = content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
      } else if (typeof content === "string") {
        summaryText = content;
      }
    }

    return summaryText || "Resumo não disponível";
  } catch (error) {
    console.error("[WEEKLY_SUMMARY] Error generating summary:", error);
    throw error;
  }
}

function buildSummaryPrompt(data: WeeklySummaryData): string {
  const weekStartStr = data.weekStart.toLocaleDateString("pt-BR");
  const weekEndStr = data.weekEnd.toLocaleDateString("pt-BR");

  const responsiblesText = data.topResponsibles
    .map((r) => `- ${r.name}: ${r.completed}/${r.total} tarefas concluídas`)
    .join("\n");

  return `Você é um assistente de gestão de tarefas. Gere um resumo executivo semanal profissional e motivador baseado nos dados abaixo.

**Sala:** ${data.roomName}
**Período:** ${weekStartStr} a ${weekEndStr}

**Estatísticas:**
- Total de tarefas: ${data.totalTasks}
- Tarefas concluídas: ${data.completedTasks}
- Tarefas pendentes: ${data.pendingTasks}
- Taxa de conclusão: ${data.completionRate.toFixed(1)}%
- Tarefas em atraso: ${data.overdueTasks}

**Desempenho por responsável:**
${responsiblesText}

Gere um resumo que:
1. Comece com uma saudação motivadora
2. Destaque os principais números e taxa de conclusão
3. Reconheça os responsáveis com melhor desempenho
4. Identifique desafios (tarefas em atraso, taxa baixa)
5. Dê recomendações para a próxima semana
6. Termine com uma mensagem positiva

Mantenha o tom profissional mas amigável. Use emojis moderadamente. Responda apenas em português.`;
}

export function calculateWeeklySummaryData(
  tasks: any[],
  roomName: string,
  weekStart: Date,
  weekEnd: Date
): WeeklySummaryData {
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Count overdue tasks (created before this week and still pending)
  const overdueTasks = tasks.filter((t) => {
    if (t.status === "pending" && t.createdAt) {
      const createdDate = new Date(t.createdAt);
      return createdDate < weekStart;
    }
    return false;
  }).length;

  // Group by responsible
  const tasksByResponsible: Record<string, { total: number; completed: number }> = {};
  tasks.forEach((task) => {
    const responsible = task.assignedToName || "Não atribuído";
    if (!tasksByResponsible[responsible]) {
      tasksByResponsible[responsible] = { total: 0, completed: 0 };
    }
    tasksByResponsible[responsible].total++;
    if (task.status === "completed") {
      tasksByResponsible[responsible].completed++;
    }
  });

  // Get top responsibles
  const topResponsibles = Object.entries(tasksByResponsible)
    .map(([name, stats]) => ({
      name,
      completed: stats.completed,
      total: stats.total,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  return {
    roomName,
    weekStart,
    weekEnd,
    totalTasks,
    completedTasks,
    pendingTasks,
    completionRate,
    overdueTasks,
    tasksByResponsible,
    topResponsibles,
  };
}
