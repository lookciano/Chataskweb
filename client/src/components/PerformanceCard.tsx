import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Trophy, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface PerformanceCardProps {
  name: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  rank?: number;
  isTopPerformer?: boolean;
}

export function PerformanceCard({
  name,
  totalTasks,
  completedTasks,
  pendingTasks,
  completionRate,
  rank,
  isTopPerformer,
}: PerformanceCardProps) {
  const getColorByRate = (rate: number) => {
    if (rate >= 80) return { bg: "bg-green-50", border: "border-l-green-500", text: "text-green-700" };
    if (rate >= 60) return { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" };
    if (rate >= 40) return { bg: "bg-yellow-50", border: "border-l-yellow-500", text: "text-yellow-700" };
    return { bg: "bg-red-50", border: "border-l-red-500", text: "text-red-700" };
  };

  const getStatusBadge = (rate: number) => {
    if (rate >= 80) return { label: "Excelente", variant: "default" as const, className: "bg-green-600" };
    if (rate >= 60) return { label: "Bom", variant: "default" as const, className: "bg-blue-600" };
    if (rate >= 40) return { label: "Regular", variant: "default" as const, className: "bg-yellow-600" };
    return { label: "Crítico", variant: "destructive" as const, className: "bg-red-600" };
  };

  const colors = getColorByRate(completionRate);
  const status = getStatusBadge(completionRate);

  return (
    <Card className={`p-6 ${colors.bg} border-l-4 ${colors.border} hover:shadow-lg transition-shadow`}>
      <div className="space-y-4">
        {/* Header: Nome e Ranking */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{name}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {completedTasks} de {totalTasks} tarefas concluídas
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isTopPerformer && (
              <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">Top</span>
              </div>
            )}
            {rank && (
              <Badge variant="outline" className="text-xs font-bold">
                #{rank}
              </Badge>
            )}
          </div>
        </div>

        {/* Taxa de Conclusão - Destaque Principal */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Taxa de Conclusão</span>
            <span className={`text-2xl font-bold ${colors.text}`}>
              {completionRate.toFixed(0)}%
            </span>
          </div>
          <Progress value={completionRate} className="h-3" />
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge className={`${status.className} text-white`}>
            {status.label}
          </Badge>
        </div>

        {/* Estatísticas em Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xs text-gray-600 font-medium">Concluídas</p>
            <p className="text-lg font-bold text-green-600">{completedTasks}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-100 mx-auto mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-xs text-gray-600 font-medium">Pendentes</p>
            <p className="text-lg font-bold text-yellow-600">{pendingTasks}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 mx-auto mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs text-gray-600 font-medium">Total</p>
            <p className="text-lg font-bold text-blue-600">{totalTasks}</p>
          </div>
        </div>

        {/* Dica/Insight */}
        {pendingTasks > 0 && (
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-600 italic">
            {pendingTasks === 1
              ? "1 tarefa aguardando conclusão"
              : `${pendingTasks} tarefas aguardando conclusão`}
          </div>
        )}
      </div>
    </Card>
  );
}
