import { Share2 } from "lucide-react";
import { toast } from "sonner";

export { Share2 };

export type ShareableTask = {
  id: number;
  taskNumber?: number;
  description: string;
  assignedToName?: string | null;
  createdAt: Date;
  status: "pending" | "completed" | "cancelled";
};

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function createTaskImage(task: ShareableTask) {
  const canvas = document.createElement("canvas");
  const width = 1200, padding = 72, lineHeight = 42;
  const title = task.taskNumber ? `Tarefa ${task.taskNumber}` : "Tarefa pessoal";
  const description = task.description.trim() || "Sem descrição";
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível");
  context.font = "32px Arial";
  const lines: string[] = [];
  let current = "";
  for (const word of description.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > width - padding * 2 && current) { lines.push(current); current = word; } else current = candidate;
  }
  if (current) lines.push(current);
  const visibleLines = lines.slice(0, 12);
  if (lines.length > visibleLines.length && visibleLines.length) visibleLines[visibleLines.length - 1] += "…";
  canvas.width = width; canvas.height = 350 + visibleLines.length * lineHeight;
  context.fillStyle = "#f8fafc"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0f766e"; context.fillRect(0, 0, canvas.width, 14);
  context.fillStyle = "#0f172a"; context.font = "bold 42px Arial"; context.fillText("Chat Task", padding, 92);
  context.font = "bold 36px Arial"; context.fillText(title, padding, 160);
  context.fillStyle = "#475569"; context.font = "26px Arial";
  context.fillText(`Criada em: ${formatDate(task.createdAt)}`, padding, 214);
  context.fillText(`Responsável: ${task.assignedToName?.trim() || "Não definido"}`, padding, 254);
  context.fillStyle = "#0f172a"; context.font = "32px Arial";
  visibleLines.forEach((line, index) => context.fillText(line, padding, 330 + index * lineHeight));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Falha ao gerar imagem")), "image/png"));
  return { blob, file: new File([blob], `chat-task-${task.id}.png`, { type: "image/png" }), title };
}

export async function shareTaskAsImage(task: ShareableTask) {
  const { blob, file, title } = await createTaskImage(task);
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title, files: [file] });
    toast.success("Imagem pronta para enviar");
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url);
  window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  toast.success("Imagem baixada", { description: "Anexe a imagem no WhatsApp Web para enviar." });
}

export function TaskShareButton({ task }: { task: ShareableTask }) {
  return (
    <button type="button" className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors" title="Compartilhar tarefa como imagem" aria-label="Compartilhar tarefa como imagem" onClick={(event) => { event.stopPropagation(); void shareTaskAsImage(task).catch((error) => { if ((error as DOMException)?.name !== "AbortError") { console.error("Erro ao compartilhar tarefa:", error); toast.error("Não foi possível gerar a imagem da tarefa"); } }); }}>
      <Share2 className="w-4 h-4" />
    </button>
  );
}
