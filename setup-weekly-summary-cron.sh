#!/bin/bash

# Script para configurar o agendamento automático de resumo semanal
# Executa toda segunda-feira às 09:00 UTC

echo "🔧 Configurando agendamento automático de resumo semanal..."

# Cron expression: 0 0 9 * * 1 (segunda-feira às 09:00 UTC)
# Formato: sec min hour dom mon dow
# 0 = segundo
# 0 = minuto
# 9 = hora (09:00 UTC)
# * = qualquer dia do mês
# * = qualquer mês
# 1 = segunda-feira

manus-heartbeat create \
  --name "weekly-summary-generation" \
  --cron "0 0 9 * * 1" \
  --path "/api/scheduled/weekly-summary" \
  --description "Gera resumo semanal automático toda segunda-feira às 09:00 UTC"

if [ $? -eq 0 ]; then
  echo "✅ Agendamento criado com sucesso!"
  echo ""
  echo "📅 Detalhes:"
  echo "  - Frequência: Toda segunda-feira"
  echo "  - Horário: 09:00 UTC"
  echo "  - Ação: Gera resumo semanal para todas as salas"
  echo "  - Envia resumo como mensagem no chat"
  echo ""
  echo "Para listar todos os agendamentos:"
  echo "  manus-heartbeat list"
  echo ""
  echo "Para pausar o agendamento:"
  echo "  manus-heartbeat update --task-uid <task_uid> --enable=false"
  echo ""
  echo "Para resumir o agendamento:"
  echo "  manus-heartbeat update --task-uid <task_uid> --enable=true"
else
  echo "❌ Erro ao criar agendamento"
  exit 1
fi
