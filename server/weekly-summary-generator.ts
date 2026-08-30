import { invokeLLM, truncateText } from "./_core/llm";

export interface WeeklySummaryTask {
  id: number;
  taskNumber: number;
  description: string;
  assignedToName: string | null;
  status: "pending" | "completed" | "cancelled";
  createdAt: Date;
  completedAt?: Date | null;
}

export interface WeeklyResponsibleSummary {
  name: string;
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  tasks: WeeklySummaryTask[];
}

export interface WeeklySummaryData {
  roomName: string;
  weekStart: Date;
  weekEnd: Date;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  cancelledTasks: number;
  completionRate: number;
  overdueTasks: number;
  tasksByResponsible: Record<string, { total: number; completed: number; pending: number; cancelled: number }>;
  responsibles: WeeklyResponsibleSummary[];
  topResponsibles: Array<{ name: string; completed: number; total: number }>;
}

export async function generateWeeklySummary(data: WeeklySummaryData): Promise<string> {
  const prompt = buildSummaryPrompt(data);
  const response = await invokeLLM({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 3000,
  });

  let summaryText = "";
  if (typeof response === "string") summaryText = response;
  else if (response.choices?.[0]) {
    const content = response.choices[0].message?.content;
    summaryText = Array.isArray(content)
      ? content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n")
      : typeof content === "string" ? content : "";
  }
  return summaryText || "Relatório não disponível";
}

function buildSummaryPrompt(data: WeeklySummaryData): string {
  const date = (value: Date) => value.toLocaleDateString("pt-BR");
  const responsibleSections = data.responsibles.map((responsible) => {
    const tasks = responsible.tasks.map((task) => {
      const status = task.status === "completed" ? "CONCLUÍDA" : task.status === "pending" ? "PENDENTE" : "CANCELADA";
      return `- Tarefa ${task.taskNumber} [${status}]: ${truncateText(task.description, 2000)}`;
    }).join("\n");
    return `RESPONSÁVEL: ${truncateText(responsible.name, 200)}\nEstatísticas: total=${responsible.total}; concluídas=${responsible.completed}; pendentes=${responsible.pending}; canceladas=${responsible.cancelled}; taxa de conclusão=${responsible.total ? ((responsible.completed / responsible.total) * 100).toFixed(1) : "0.0"}%\nAtividades:\n${truncateText(tasks, 12000)}`;
  }).join("\n\n");

  return `Você é um analista de controle de tarefas. Gere um relatório semanal analítico, direto e preciso, sem avaliar pessoas, sem elogios, críticas, comentários sobre desempenho e sem recomendações genéricas.

Sala: ${truncateText(data.roomName, 200)}
Período: ${date(data.weekStart)} a ${date(data.weekEnd)}

ESTATÍSTICAS DA SALA
- Total de atividades: ${data.totalTasks}
- Concluídas: ${data.completedTasks}
- Pendentes: ${data.pendingTasks}
- Canceladas: ${data.cancelledTasks}
- Taxa de conclusão: ${data.completionRate.toFixed(1)}%
- Pendências anteriores ao início do período: ${data.overdueTasks}

DADOS POR RESPONSÁVEL
${responsibleSections || "Nenhum responsável com atividades no período."}

FORMATO OBRIGATÓRIO
# Relatório semanal — ${data.roomName}
Período: ${date(data.weekStart)} a ${date(data.weekEnd)}

## Resumo estatístico da sala
Apresente os números gerais acima.

## Responsável: Nome
- Estatísticas: total, concluídas, pendentes, canceladas e taxa de conclusão.
- Atividades concluídas: liste o número e a descrição completa de cada uma.
- Atividades pendentes: liste o número e a descrição completa de cada uma.
- Atividades canceladas: liste o número e a descrição completa de cada uma, se houver.

Repita a seção para TODOS os responsáveis, sem limitar a quantidade. Preserve exatamente os números e as descrições fornecidas. O relatório deve permitir identificar as pendências e montar um plano de ação. Não invente prazos, causas ou responsáveis. Responda somente em português e não inclua juízo de valor sobre o desempenho.`;
}

export function calculateWeeklySummaryData(tasks: any[], roomName: string, weekStart: Date, weekEnd: Date): WeeklySummaryData {
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const pendingTasks = tasks.filter((task) => task.status === "pending").length;
  const cancelledTasks = tasks.filter((task) => task.status === "cancelled").length;
  const totalTasks = tasks.length;
  const tasksByResponsible: WeeklySummaryData["tasksByResponsible"] = {};
  const groups = new Map<string, WeeklyResponsibleSummary>();


  for (const task of tasks) {
    const name = task.assignedToName || "Não atribuído";
    const normalized: WeeklySummaryTask = { ...task, assignedToName: task.assignedToName || null };
    const current: WeeklyResponsibleSummary = groups.get(name) || { name, total: 0, completed: 0, pending: 0, cancelled: 0, tasks: [] };
    current.total += 1;
    current[task.status === "completed" ? "completed" : task.status === "cancelled" ? "cancelled" : "pending"] += 1;
    current.tasks.push(normalized);
    groups.set(name, current);
    tasksByResponsible[name] = { total: current.total, completed: current.completed, pending: current.pending, cancelled: current.cancelled };
  }

  const responsibles = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const overdueTasks = tasks.filter((task) => task.status === "pending" && new Date(task.createdAt) < weekStart).length;
  return {
    roomName, weekStart, weekEnd, totalTasks, completedTasks, pendingTasks, cancelledTasks,
    completionRate: totalTasks ? (completedTasks / totalTasks) * 100 : 0,
    overdueTasks, tasksByResponsible, responsibles,
    topResponsibles: responsibles.map(({ name, completed, total }) => ({ name, completed, total })),
  };
}
