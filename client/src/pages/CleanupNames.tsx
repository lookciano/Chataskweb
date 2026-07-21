import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function CleanupNames() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const cleanupMutation = trpc.tasks.cleanupAllParticipantNames.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setLoading(false);
    },
    onError: (error) => {
      setResult({ error: error.message });
      setLoading(false);
    },
  });

  const handleCleanup = async () => {
    setLoading(true);
    setResult(null);
    await cleanupMutation.mutateAsync();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Limpeza de Nomes de Participantes</h1>
      
      <Card className="p-6 mb-6">
        <p className="text-gray-600 mb-4">
          Esta ferramenta irá verificar todas as tarefas em todas as salas e corrigir nomes de participantes 
          que não correspondem exatamente aos nomes na lista de participantes.
        </p>
        
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Este processo irá atualizar o banco de dados. Certifique-se de que está autorizado a fazer isso.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleCleanup} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            'Iniciar Limpeza'
          )}
        </Button>
      </Card>

      {result && (
        <Card className="p-6">
          {result.error ? (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Erro: {result.error}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mr-2" />
                  <h2 className="text-2xl font-bold text-green-600">Limpeza Concluída!</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Salas Processadas</p>
                    <p className="text-3xl font-bold text-blue-600">{result.totalRooms}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Tarefas Corrigidas</p>
                    <p className="text-3xl font-bold text-green-600">{result.totalCorrected}</p>
                  </div>
                  {result.totalInvalid > 0 && (
                    <div className="bg-yellow-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Tarefas Inválidas</p>
                      <p className="text-3xl font-bold text-yellow-600">{result.totalInvalid}</p>
                    </div>
                  )}
                </div>
              </div>

              {result.reports && result.reports.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Detalhes por Sala</h3>
                  <div className="space-y-4">
                    {result.reports.map((report: any) => (
                      <div key={report.roomId} className="border rounded p-4">
                        <h4 className="font-bold text-lg mb-2">{report.roomName}</h4>
                        
                        <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                          <div>
                            <span className="text-gray-600">Total de Tarefas:</span>
                            <p className="font-bold">{report.totalTasks}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Válidas:</span>
                            <p className="font-bold text-green-600">{report.validTasks}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Corrigidas:</span>
                            <p className="font-bold text-blue-600">{report.correctedTasks}</p>
                          </div>
                        </div>

                        {report.corrections && report.corrections.length > 0 && (
                          <div className="bg-gray-50 p-3 rounded text-sm">
                            <p className="font-bold mb-2">Correções:</p>
                            <ul className="space-y-1">
                              {report.corrections.map((correction: any, idx: number) => (
                                <li key={idx} className="text-gray-700">
                                  Tarefa #{correction.taskId}: "{correction.oldName}" → "{correction.newName}"
                                  <span className="text-gray-500 text-xs ml-2">({correction.reason})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
