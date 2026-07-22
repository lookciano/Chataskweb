import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Calendar,
  User,
  Trash2,
  ChevronDown,
  X,
  TrendingUp,
  Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

interface Task {
  id: number;
  messageId: number;
  chatRoomId: number;
  creatorId: number;
  assignedToId: number | null;
  assignedToName: string | null;
  taskNumber: number;
  description: string;
  dueDate: Date | null;
  priority: string;
  status: "pending" | "completed";
  createdAt: Date;
  completedAt?: Date | null;
  updatedAt: Date;
}

interface ParticipantMetrics {
  name: string;
  total: number;
  pending: number;
  completed: number;
  completionRate: number;
}

export default function ProductivityReport() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedRoom, setSelectedRoom] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [showResponsibleFilter, setShowResponsibleFilter] = useState(false);
  const [selectedChartResponsibles, setSelectedChartResponsibles] = useState<string[]>([]);
  const [showChartResponsibleFilter, setShowChartResponsibleFilter] = useState(false);

  // Queries
  const roomsQuery = trpc.chat.rooms.useQuery();
  const tasksQuery = trpc.tasks.list.useQuery(
    { chatRoomId: selectedRoom || 0 },
    { enabled: !!selectedRoom }
  );

  const tasks = useMemo(() => {
    if (!tasksQuery.data) return [];
    return tasksQuery.data as unknown as Task[];
  }, [tasksQuery.data]);

  const allResponsibles = useMemo(() => {
    const responsibles = new Set<string>();
    tasks.forEach((task) => {
      if (task.assignedToName) {
        responsibles.add(task.assignedToName);
      }
    });
    return Array.from(responsibles).sort();
  }, [tasks]);

  const timelineData = useMemo(() => {
    const timeline: Record<string, { date: string; created: number; completed: number }> = {};
    
    // Filter tasks by selected responsible if any are selected
    const filteredTasksForChart = selectedChartResponsibles.length === 0 
      ? tasks 
      : tasks.filter(task => task.assignedToName && selectedChartResponsibles.includes(task.assignedToName));
    
    filteredTasksForChart.forEach((task) => {
      const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
      if (!timeline[createdDate]) {
        timeline[createdDate] = { date: createdDate, created: 0, completed: 0 };
      }
      timeline[createdDate].created++;
      
      // Use updatedAt when status is completed (since completedAt field doesn't exist)
      if (task.status === "completed") {
        const completedDate = new Date(task.updatedAt).toISOString().split('T')[0];
        if (!timeline[completedDate]) {
          timeline[completedDate] = { date: completedDate, created: 0, completed: 0 };
        }
        timeline[completedDate].completed++;
      }
    });
    
    return Object.values(timeline).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [tasks, selectedChartResponsibles]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesResponsible =
        selectedResponsibles.length === 0 ||
        (task.assignedToName && selectedResponsibles.includes(task.assignedToName));

      return matchesSearch && matchesResponsible;
    });
  }, [tasks, searchQuery, selectedResponsibles]);

  const pendingTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === "pending");
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === "completed");
  }, [filteredTasks]);

  const participantMetrics = useMemo(() => {
    const metrics: Record<string, ParticipantMetrics> = {};

    tasks.forEach((task) => {
      const responsible = task.assignedToName || "Sem responsável";
      if (!metrics[responsible]) {
        metrics[responsible] = {
          name: responsible,
          total: 0,
          pending: 0,
          completed: 0,
          completionRate: 0,
        };
      }

      metrics[responsible].total++;
      if (task.status === "pending") {
        metrics[responsible].pending++;
      } else {
        metrics[responsible].completed++;
      }
    });

    // Calculate completion rates
    Object.values(metrics).forEach((m) => {
      m.completionRate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
    });

    return Object.values(metrics).sort((a, b) => b.total - a.total);
  }, [tasks]);

  const chartData = useMemo(() => {
    return participantMetrics.map((metric) => ({
      name: metric.name,
      pending: metric.pending,
      completed: metric.completed,
    }));
  }, [participantMetrics]);

  const toggleResponsible = (name: string) => {
    setSelectedResponsibles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const deleteTaskMutation = trpc.tasks.deleteTask.useMutation();

  const deleteTask = async (taskId: number) => {
    try {
      await deleteTaskMutation.mutateAsync({ taskId });
      tasksQuery.refetch();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-green-100 text-green-800 border-green-300";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      default:
        return "Baixa";
    }
  };

  if (!user) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <ScrollArea className="h-screen">
        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/chat")}
              className="border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              ← Voltar
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Relatório de Atividades
            </h1>
          </div>
          <p className="text-slate-600 ml-12">Acompanhe o desempenho das tarefas por participante</p>
        </div>

        {/* Room Selector */}
        <div className="mb-8">
          <Select value={selectedRoom?.toString()} onValueChange={(v) => setSelectedRoom(parseInt(v))}>
            <SelectTrigger className="w-full md:w-64 bg-white border-slate-200 border-2">
              <SelectValue placeholder="Selecione uma sala" />
            </SelectTrigger>
            <SelectContent>
              {roomsQuery.data?.map((room: any) => (
                <SelectItem key={room.id} value={room.id.toString()}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRoom && (
          <>
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-white border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Total de Tarefas</p>
                    <p className="text-3xl font-bold text-slate-900">{tasks.length}</p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Target className="w-6 h-6 text-slate-600" />
                  </div>
                </div>
              </Card>

              <Card className="bg-white border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Pendentes</p>
                    <p className="text-3xl font-bold text-orange-600">{pendingTasks.length}</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Circle className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </Card>

              <Card className="bg-white border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Concluídas</p>
                    <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </Card>

              <Card className="bg-white border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Taxa de Conclusão</p>
                    <p className="text-3xl font-bold text-teal-600">
                      {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
                    </p>
                  </div>
                  <div className="p-3 bg-teal-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-teal-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Participant Indicators */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Indicadores por Participante</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {participantMetrics.map((metric) => (
                  <Card key={metric.name} className="bg-white border-slate-200 hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 truncate text-sm">{metric.name}</h3>
                        <div className="text-2xl font-bold text-teal-600">{metric.completionRate}%</div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Total</span>
                          <span className="font-semibold text-slate-900">{metric.total}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Pendentes</span>
                          <span className="font-semibold text-orange-600">{metric.pending}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Concluídas</span>
                          <span className="font-semibold text-green-600">{metric.completed}</span>
                        </div>
                      </div>

                      {/* Mini Bar Chart */}
                      <div className="mt-4 h-16 flex items-end justify-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-4 bg-orange-500 rounded-t"
                            style={{ height: `${Math.max((metric.pending / Math.max(metric.total, 1)) * 100, 8)}%` }}
                          />
                          <span className="text-xs text-slate-600">P</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-4 bg-green-500 rounded-t"
                            style={{ height: `${Math.max((metric.completed / Math.max(metric.total, 1)) * 100, 8)}%` }}
                          />
                          <span className="text-xs text-slate-600">C</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all"
                          style={{ width: `${metric.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Bar Chart by Responsible */}
            <div className="mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Tarefas por Responsável</h2>
              <div className="w-full h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value) => value}
                    />
                    <Legend />
                    <Bar dataKey="pending" fill="#f97316" name="Pendentes" />
                    <Bar dataKey="completed" fill="#22c55e" name="Concluídas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Timeline Chart */}
            <div className="mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Evolução de Tarefas</h2>
                <div className="relative">
                  <Button
                    variant="outline"
                    className="justify-between bg-slate-50 border-slate-200"
                    onClick={() => setShowChartResponsibleFilter(!showChartResponsibleFilter)}
                  >
                    <span>
                      {selectedChartResponsibles.length === 0
                        ? "Filtrar por responsável"
                        : `${selectedChartResponsibles.length} selecionado(s)`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showChartResponsibleFilter && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                      <div className="p-4 max-h-64 overflow-y-auto">
                        {allResponsibles.map((responsible) => (
                          <label key={responsible} className="flex items-center gap-2 mb-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedChartResponsibles.includes(responsible)}
                              onChange={() => {
                                setSelectedChartResponsibles((prev) =>
                                  prev.includes(responsible)
                                    ? prev.filter((r) => r !== responsible)
                                    : [...prev, responsible]
                                );
                              }}
                              className="rounded border-slate-300"
                            />
                            <span className="text-sm text-slate-700">{responsible}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedChartResponsibles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedChartResponsibles.map((responsible) => (
                    <Badge key={responsible} variant="secondary" className="bg-slate-100 text-slate-800">
                      {responsible}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() =>
                          setSelectedChartResponsibles((prev) => prev.filter((r) => r !== responsible))
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
              <div className="w-full h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="created" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCreated)" name="Criadas" />
                    <Area type="monotone" dataKey="completed" stroke="#22c55e" fillOpacity={1} fill="url(#colorCompleted)" name="Concluídas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task List Section */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Lista de Tarefas</h2>

                {/* Filters */}
                <div className="flex flex-col gap-4">
                  <Input
                    placeholder="Buscar por descrição ou responsável..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border-slate-200"
                  />

                  {/* Responsible Filter */}
                  <div className="relative">
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-slate-50 border-slate-200"
                      onClick={() => setShowResponsibleFilter(!showResponsibleFilter)}
                    >
                      <span>
                        {selectedResponsibles.length === 0
                          ? "Filtrar por responsável"
                          : `${selectedResponsibles.length} selecionado(s)`}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>

                    {showResponsibleFilter && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-4">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {allResponsibles.map((responsible) => (
                            <label key={responsible} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedResponsibles.includes(responsible)}
                                onChange={() => toggleResponsible(responsible)}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm text-slate-700">{responsible}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected badges */}
                    {selectedResponsibles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedResponsibles.map((responsible) => (
                          <Badge key={responsible} variant="secondary" className="bg-teal-100 text-teal-800">
                            {responsible}
                            <button
                              onClick={() => toggleResponsible(responsible)}
                              className="ml-1 hover:text-teal-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs for Pending and Completed */}
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b border-slate-200 bg-slate-50 p-0">
                  <TabsTrigger
                    value="pending"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-white"
                  >
                    <Circle className="w-4 h-4 mr-2 text-orange-500" />
                    Pendentes ({pendingTasks.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="completed"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                    Concluídas ({completedTasks.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="p-6">
                  {pendingTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <p className="text-slate-600">Nenhuma tarefa pendente!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTasks.map((task) => (
                        <Card key={task.id} className="border-slate-200 hover:shadow-md transition-shadow">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-slate-900">Tarefa #{task.id}</span>
                                  <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                    {getPriorityLabel(task.priority)}
                                  </Badge>
                                </div>
                                <p className="text-slate-700 mb-3">{task.description}</p>
                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                  {task.assignedToName && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-4 h-4" />
                                      <span>{task.assignedToName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Criada em: {formatDate(task.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTask(task.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="completed" className="p-6">
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <Circle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">Nenhuma tarefa concluída ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {completedTasks.map((task) => (
                        <Card key={task.id} className="border-slate-200 bg-slate-50 hover:shadow-md transition-shadow">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-slate-900">Tarefa #{task.id}</span>
                                  <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                    {getPriorityLabel(task.priority)}
                                  </Badge>
                                </div>
                                <p className="text-slate-700 mb-3 line-through text-slate-500">
                                  {task.description}
                                </p>
                                <div className="flex flex-col gap-3 text-sm text-slate-600">
                                  {task.assignedToName && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-4 h-4" />
                                      <span>{task.assignedToName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Criada em: {formatDate(task.createdAt)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Concluída em: {formatDate(task.completedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTask(task.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
