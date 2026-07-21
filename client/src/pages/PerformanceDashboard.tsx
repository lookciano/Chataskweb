import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PerformanceCard } from "@/components/PerformanceCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  Trophy,
  Calendar,
} from "lucide-react";

interface ResponsibleStats {
  name: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
}

export default function PerformanceDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("individuals");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [period, setPeriod] = useState("month");

  // Queries
  const roomsQuery = trpc.chat.rooms.useQuery();
  const allTasksQuery = trpc.tasks.allTasks.useQuery({});

  const allTasks = allTasksQuery.data || [];
  const rooms = roomsQuery.data || [];

  // Set default room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  // Filtrar tarefas pela sala
  const filteredTasks = useMemo(() => {
    if (!selectedRoomId) return [];
    return allTasks.filter((task: any) => task.chatRoomId === selectedRoomId);
  }, [selectedRoomId, allTasks]);

  // Calcular estatísticas por responsável
  const responsibleStats = useMemo(() => {
    const stats: Record<string, ResponsibleStats> = {};

    filteredTasks.forEach((task: any) => {
      const responsible = task.assignedToName || "Não atribuído";
      if (!stats[responsible]) {
        stats[responsible] = {
          name: responsible,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          completionRate: 0,
        };
      }
      stats[responsible].totalTasks++;
      if (task.status === "completed") {
        stats[responsible].completedTasks++;
      } else {
        stats[responsible].pendingTasks++;
      }
    });

    // Calcular taxa de conclusão
    Object.values(stats).forEach((stat) => {
      stat.completionRate =
        stat.totalTasks > 0 ? (stat.completedTasks / stat.totalTasks) * 100 : 0;
    });

    // Ordenar por taxa de conclusão (descendente)
    return Object.values(stats).sort(
      (a, b) => b.completionRate - a.completionRate
    );
  }, [filteredTasks]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    return responsibleStats.map((stat) => ({
      name: stat.name,
      concluídas: stat.completedTasks,
      pendentes: stat.pendingTasks,
      total: stat.totalTasks,
    }));
  }, [responsibleStats]);

  const pieData = useMemo(() => {
    return responsibleStats.map((stat) => ({
      name: stat.name,
      value: stat.totalTasks,
    }));
  }, [responsibleStats]);

  // KPIs gerais
  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t: any) => t.status === "completed").length;
    const pending = filteredTasks.filter((t: any) => t.status === "pending").length;
    const avgCompletion = responsibleStats.length > 0
      ? responsibleStats.reduce((sum, stat) => sum + stat.completionRate, 0) /
        responsibleStats.length
      : 0;

    return {
      total,
      completed,
      pending,
      avgCompletion,
      topPerformer: responsibleStats[0],
    };
  }, [filteredTasks, responsibleStats]);

  const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/chat")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard de Desempenho
            </h1>
            <p className="text-gray-600">Análise detalhada de produtividade por responsável</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 flex-wrap">
          <Select value={selectedRoomId?.toString() || ""} onValueChange={(val) => setSelectedRoomId(Number(val))}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione uma sala" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id.toString()}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Último Mês</SelectItem>
              <SelectItem value="quarter">Último Trimestre</SelectItem>
              <SelectItem value="all">Todo o Período</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6 bg-white border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total de Tarefas</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.total}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Concluídas</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.completed}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Pendentes</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.pending}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Taxa Média</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {kpis.avgCompletion.toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Abas */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white p-1 rounded-lg border">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="individuals">Responsáveis</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* Aba: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {kpis.topPerformer && (
            <Card className="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
              <div className="flex items-start gap-4">
                <Trophy className="w-8 h-8 text-yellow-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">Melhor Desempenho</h3>
                  <p className="text-gray-600 mt-1">
                    {kpis.topPerformer.name} lidera com{" "}
                    <span className="font-bold text-yellow-600">
                      {kpis.topPerformer.completionRate.toFixed(1)}%
                    </span>{" "}
                    de taxa de conclusão
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Distribuição de Tarefas</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Status das Tarefas</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="concluídas" fill="#10b981" />
                  <Bar dataKey="pendentes" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        {/* Aba: Responsáveis */}
        <TabsContent value="individuals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responsibleStats.map((stat, index) => (
              <PerformanceCard
                key={stat.name}
                name={stat.name}
                totalTasks={stat.totalTasks}
                completedTasks={stat.completedTasks}
                pendingTasks={stat.pendingTasks}
                completionRate={stat.completionRate}
                rank={index + 1}
                isTopPerformer={index === 0}
              />
            ))}
          </div>
        </TabsContent>

        {/* Aba: Gráficos */}
        <TabsContent value="charts" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Desempenho por Responsável</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="concluídas" fill="#10b981" />
                <Bar dataKey="pendentes" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Taxa de Conclusão</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={responsibleStats.map((stat) => ({
                  name: stat.name,
                  taxa: stat.completionRate,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: any) => `${typeof value === 'number' ? value.toFixed(1) : value}%`} />
                <Line
                  type="monotone"
                  dataKey="taxa"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6", r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* Aba: Ranking */}
        <TabsContent value="ranking" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-6">Ranking de Desempenho</h3>
            <div className="space-y-3">
              {responsibleStats.map((stat, index) => (
                <div
                  key={stat.name}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{stat.name}</p>
                    <p className="text-sm text-gray-600">
                      {stat.completedTasks} de {stat.totalTasks} tarefas concluídas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.completionRate.toFixed(1)}%
                    </p>
                    <Badge
                      className={
                        stat.completionRate >= 80
                          ? "bg-green-100 text-green-800"
                          : stat.completionRate >= 60
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {stat.completionRate >= 80
                        ? "Excelente"
                        : stat.completionRate >= 60
                        ? "Bom"
                        : "Precisa Melhorar"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
