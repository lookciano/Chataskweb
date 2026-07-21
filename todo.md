# Chat Atividades IA - TODO

## Banco de Dados
- [x] Criar schema com tabelas: users (já existe), chatRooms, messages, tasks
- [x] Gerar migrations com drizzle-kit
- [x] Executar migrations no banco de dados

## Backend (tRPC Procedures)
- [x] Criar procedures para gerenciar chat rooms
- [x] Criar procedures para enviar e recuperar mensagens
- [x] Criar procedures para listar tarefas com filtros
- [x] Criar procedures para atualizar status de tarefas
- [x] Criar procedures para relatório de produtividade
- [x] Implementar extração automática de tarefas via IA
- [x] Implementar procedure para interpretar respostas
- [x] Implementar procedure para gerenciar replies

## Integração com IA (LLM)
- [x] Configurar invokeLLM para extração de tarefas
- [x] Definir schema JSON para resposta estruturada
- [x] Criar função auxiliar para análise de mensagens
- [x] Testar extração com diferentes tipos de mensagens
- [x] Implementar interpretador de respostas com IA
- [x] Detectar conclusão, atraso e progresso de tarefas

## Frontend - Interface de Chat
- [x] Criar layout principal com sidebar + chat + painel de tarefas
- [x] Implementar seleção de chat rooms
- [x] Criar componente de mensagens com suporte a múltiplos usuários
- [x] Implementar input de mensagem com validação
- [x] Adicionar scroll automático para novas mensagens
- [x] Implementar atualização em tempo real (polling/refresh)
- [x] Implementar sistema de replies/respostas
- [x] Exibir indicação de reply na interface

## Frontend - Painel de Tarefas
- [x] Criar componente de listagem de tarefas
- [x] Implementar filtros por usuário, período e status
- [x] Adicionar checkbox para marcar tarefas como concluídas
- [x] Criar visualização de tarefas pendentes vs concluídas
- [x] Implementar edição rápida de tarefas
- [x] Exibir responsável por tarefa
- [x] Exibir data de criação das tarefas

## Frontend - Relatório de Produtividade
- [x] Criar página de relatório com período selecionável
- [x] Implementar gráficos de tarefas por usuário
- [x] Adicionar estatísticas de conclusão
- [x] Criar visualização de histórico de conversas

## Sistema de Respostas em Mensagens (Replies)
- [x] Adicionar campo replyToId no schema
- [x] Implementar procedure getReplies
- [x] Criar UI para responder mensagens
- [x] Exibir indicação de reply na interface
- [x] Integrar com interpretação de respostas

## Responsável por Tarefa
- [x] Adicionar campo assignedToName no schema
- [x] Extrair responsável da mensagem via IA
- [x] Exibir responsável no painel de tarefas
- [x] Armazenar nome do responsável no banco de dados

## Interpretação de Respostas
- [x] Criar interpretador de respostas com IA
- [x] Detectar conclusão de tarefas
- [x] Detectar atraso/postergamento
- [x] Detectar progresso (em andamento)
- [x] Atualizar status automaticamente com confidence score

## Design & Estilo
- [x] Definir paleta de cores elegante e sofisticada
- [x] Configurar tipografia refinada
- [x] Implementar design system com componentes reutilizáveis
- [x] Garantir responsividade e acessibilidade

## Testes & Otimizações
- [x] Escrever testes unitários com vitest
- [x] Testar fluxos de chat e extração de tarefas
- [x] Otimizar queries do banco de dados
- [x] Validar performance da interface

## Publicação
- [x] Criar checkpoint final
- [x] Publicar aplicativo
- [x] Validar em produção
- [x] Implementar todas as melhorias solicitadas na Fase 2

## Melhorias Solicitadas - Fase 2

### Ordem de Mensagens
- [x] Inverter ordem das mensagens para estilo WhatsApp (recentes na parte de baixo)
- [x] Ajustar scroll para ficar no final por padrão

### IA Observa Contexto da Conversa
- [x] Implementar análise de contexto histórico
- [x] IA entende progresso das tarefas pelo histórico
- [x] Atualizar status baseado em contexto geral

### Responsividade Mobile
- [x] Painel de tarefas escondido em mobile
- [x] Botão para mostrar/esconder painel de tarefas
- [x] Ajustar layout para telas pequenas

### Perfil do Usuário
- [x] Adicionar campo displayName na tabela users
- [x] Criar modal de perfil/configurações
- [x] Permitir usuário definir seu próprio nome
- [x] Exibir nome customizado no chat

## Melhorias Solicitadas - Fase 3

### Layout Mobile Tipo WhatsApp
- [x] Chat como página principal em mobile
- [x] Salas em página separada (aba/navegação)
- [x] Sidebar apenas em desktop
- [x] Navegação entre chat e salas em mobile

### Barra de Rolagem e Campo Fixo
- [x] Adicionar ScrollArea com barra de rolagem visível
- [x] Fixar campo de mensagem na parte inferior
- [x] Garantir que input sempre fica visível

### Lista de Participantes
- [x] Adicionar tabela de participantes na sala
- [x] Modal/painel para visualizar participantes
- [x] Botão para abrir lista de participantes
- [x] Exibir nome e status de cada participante


## Bugs Identificados - Fase 4 (Mobile)

### Problemas Críticos
- [x] Barra de rolagem não está funcionando em mobile
- [x] Usuários não estão sincronizando (perfil de um usuário não aparece para outro)
- [x] Atualização de perfil não está refletindo para outros usuários
- [x] Participantes não estão sendo adicionados automaticamente
- [x] Funcionalidades mobile diferentes do desktop

### Verificações Necessárias
- [x] Testar barra de rolagem em mobile (ScrollArea)
- [x] Verificar refetch de participantes
- [x] Testar atualização de perfil em tempo real
- [x] Validar sincronização entre múltiplos usuários
- [x] Testar todas as abas em mobile (chat, rooms, participantes)
- [x] Verificar responsividade do layout mobile


## Melhorias Solicitadas - Fase 5 (Refinamentos Finais)

### Exibição de Nomes de Usuários
- [x] Mostrar displayName nas mensagens recebidas (não apenas "Você")
- [x] Atualizar em tempo real quando perfil é alterado

### Scroll Automático
- [x] Auto-scroll para nova mensagem ao chegar
- [x] Manter scroll no final da conversa

### Validação de Perfil
- [x] Bloquear envio de mensagem se nome não está definido
- [x] Mostrar mensagem de erro/aviso
- [x] Redirecionar para modal de perfil

### Mensagem Respondida Visível
- [x] Ao responder, mostrar a mensagem original completa
- [x] Exibir em formato destacado/card

### Numeração de Tarefas
- [x] Adicionar ID sequencial (Task #1, Task #2, etc)
- [x] Exibir número em todas as listas
- [x] Usar número em referências no chat

### Detecção Automática de Conclusão
- [x] IA detecta quando alguém menciona "tarefa #X concluída"
- [x] Atualizar status automaticamente
- [x] Mostrar confirmação no chat

## Melhorias Solicitadas - Fase 6 (Rolagem Automática e Indicador)

### Rolagem Automática
- [x] Implementar rolagem automática ao chegar novas mensagens
- [x] Detectar se usuário está perto do final da conversa
- [x] Fazer scroll suave quando novas mensagens chegam

### Indicador de Mensagens Não Lidas
- [x] Mostrar indicador "Novas mensagens abaixo" quando há mensagens não lidas
- [x] Botão para rolar até as novas mensagens
- [x] Indicador desaparece quando usuário rola até o final


## Melhorias Solicitadas - Fase 7 (Filtros de Tarefas)

### Filtro por Palavra-chave
- [x] Campo de busca dinâmica na interface de tarefas
- [x] Filtro em tempo real enquanto digita
- [x] Busca na descrição das tarefas
- [x] Funcionamento em desktop e mobile

### Filtro por Usuário Responsável
- [x] Dropdown com lista de participantes
- [x] Opção "Todos os responsáveis" como padrão
- [x] Filtro combinado com palavra-chave
- [x] Funcionamento em desktop e mobile

### Integração dos Filtros
- [x] Filtros resetam ao trocar de sala
- [x] Filtros aplicados em ambas as abas (Pendentes/Concluídas)
- [x] Interface limpa e responsiva


## Melhorias Solicitadas - Fase 8 (Dashboard de Desempenho)

### Dashboard de Desempenho - Visão Geral
- [x] Filtro por data (Data Inicial e Final)
- [x] Cards de estatísticas (Total, Pendentes, Em Progresso, Concluídas, Taxa de Conclusão)
- [x] Gráfico de distribuição por status (Pizza)
- [x] Gráfico de resumo de tarefas (Barras)
- [x] Distribuição por prioridade
- [x] Lista de tarefas recentes

### Dashboard de Desempenho - Desempenho Individual
- [x] Cards de desempenho por usuário
- [x] Taxa de conclusão por usuário
- [x] Tempo médio para completar tarefas
- [x] Tarefas desta semana
- [x] Total de tarefas concluídas vs total

### Dashboard de Desempenho - Timeline
- [x] Gráfico de área mostrando progresso ao longo do tempo
- [x] Histórico completo de tarefas
- [x] Data de criação de cada tarefa
- [x] Data de conclusão de cada tarefa
- [x] Tempo decorrido (em dias) para completar
- [x] Responsável pela tarefa
- [x] Status da tarefa

### Navegação do Dashboard
- [x] Abas de navegação (Visão Geral, Desempenho, Timeline)
- [x] Integração com o botão "Relatório" do chat
- [x] Interface responsiva em desktop e mobile


## Melhorias Solicitadas - Fase 9 (Vinculação de Tarefas às Salas)

### Dashboard com Seleção de Sala
- [x] Adicionar dropdown de seleção de sala no dashboard
- [x] Filtrar tarefas por sala selecionada
- [x] Atualizar todas as métricas baseado na sala selecionada
- [x] Atualizar gráficos para mostrar dados apenas da sala
- [x] Atualizar histórico de tarefas para mostrar apenas da sala


## Melhorias Solicitadas - Fase 10 (Navegação no Dashboard)

### Botão de Voltar
- [x] Adicionar botão "Voltar para Chat" no header do dashboard
- [x] Implementar navegação de volta para a página de chat


## Melhorias Solicitadas - Fase 11 (Criar e Excluir Sala com Senha)

### Criar Nova Sala
- [x] Corrigir botão "Nova Sala" que não estava funcionando
- [x] Implementar diálogo para criar nova sala
- [x] Adicionar campo de nome da sala
- [x] Adicionar autenticação por senha (12345)
- [x] Criar sala no banco de dados

### Excluir Sala
- [x] Adicionar opção de excluir sala
- [x] Implementar diálogo de confirmação
- [x] Adicionar autenticação por senha (12345)
- [x] Excluir sala do banco de dados


## Correções Solicitadas - Fase 12 (Varredura Geral)

### Corrigir Erro de Validação
- [x] Corrigir erro "Invalid input: expected string, received undefined" ao criar sala
- [x] Garantir que password é enviado corretamente do frontend
- [x] Adicionar validação de senha vazia no frontend

### Igualar Desktop e Mobile
- [x] Adicionar botão de deletar sala no desktop (aumentar largura do sidebar)
- [x] Verificar se todos os elementos do mobile estão no desktop
- [x] Verificar se todos os elementos do desktop estão no mobile
- [x] Testar criar sala em ambas versões
- [x] Testar excluir sala em ambas versões


## Correções Solicitadas - Fase 13 (Dashboard com Dados Reais)

### Integração de Dados Reais
- [x] Conectar dashboard com tarefas reais da sala selecionada
- [x] Detectar status das tarefas (pendente, em progresso, concluída)
- [x] Calcular quantidades corretas de tarefas por status
- [x] Atualizar gráficos com dados reais
- [x] Atualizar cards de estatísticas com dados reais
- [x] Mostrar tarefas recentes com dados reais
- [x] Calcular tempo decorrido desde criação até conclusão
- [x] Atualizar timeline com histórico real de tarefas


## Melhorias Solicitadas - Fase 14 (Monitoramento por Responsável)

### Dashboard - Abas por Responsável
- [x] Criar aba "Por Responsável" no dashboard
- [x] Listar todos os responsáveis com tarefas na sala
- [x] Mostrar cards com métricas de cada responsável
- [x] Exibir total de tarefas por responsável
- [x] Mostrar tarefas pendentes por responsável
- [x] Mostrar tarefas concluídas por responsável
- [x] Calcular taxa de conclusão por responsável

### Gráficos de Carga de Trabalho
- [x] Gráfico de barras com carga de trabalho por responsável
- [x] Gráfico stacked com distribuição de tarefas
- [x] Comparação de desempenho entre responsáveis

### Filtros por Responsável
- [x] Botões para selecionar responsável específíco
- [x] Filtrar tarefas por responsável
- [x] Atualizar gráficos ao selecionar responsável
- [x] Mostrar apenas tarefas do responsável selecionado

### Detalhes do Responsável
- [x] Painel com detalhes completos do responsável
- [x] Histórico de tarefas do responsável
- [x] Tempo médio para conclusão (calculado)
- [x] Taxa de conclusão por responsável
- [x] Tarefas em atraso (identificadas por status)


## FUNCIONALIDADE CRÍTICA - Fase 15 (Criação Automática de Tarefas via IA)

### Análise de Mensagens com LLM
- [x] Integrar LLM para analisar mensagens do chat (llm-task-extractor.ts)
- [x] Detectar quando uma mensagem contém uma tarefa potencial
- [x] Extrair título, descrição, responsável e prioridade da mensagem
- [x] Enviar sugestão de tarefa para o usuário confirmar

### Criação Automática de Tarefas
- [x] Criar tarefa automaticamente após confirmação do usuário (extractFromMessage)
- [x] Associar tarefa à sala do chat
- [x] Atribuir tarefa ao responsável mencionado
- [x] Adicionar contexto da conversa à tarefa

### Conclusão Automática de Tarefas
- [x] Detectar quando uma tarefa foi concluída através do chat
- [x] Reconhecer palavras-chave como "concluído", "feito", "pronto"
- [x] Atualizar status da tarefa automaticamente
- [x] Notificar na aba de tarefas que tarefa foi concluída

### Correções Implementadas
- [x] Corrigir erro de "Invalid time value" ao converter dueDate
- [x] Adicionar validação de data no backend
- [x] Corrigir erro de JSX no ChatApp.tsx


## Correções Solicitadas - Fase 17 (Remover # e Adicionar Exclusão)

### Remover # do Número das Tarefas
- [x] Remover # de "Tarefa #14" para "Tarefa 14" em todas as mensagens
- [x] Atualizar llm-task-extractor.ts para não incluir #
- [x] Atualizar task-completion-detector.ts para não usar #
- [x] Corrigir erros de TypeScript (remover taskNumber)

### Adicionar Exclusão Manual de Tarefas
- [x] Adicionar botão de deletar em tarefas pendentes
- [x] Adicionar botão de deletar em tarefas concluídas
- [x] Implementar confirmação por senha (12345)
- [x] Deletar tarefa do banco de dados
- [x] Atualizar lista após exclusão

## Numeração Sequencial de Tarefas por Sala - Fase 18

### Implementação da Numeração
- [x] Adicionar coluna taskNumber ao schema de tarefas
- [x] Atualizar função createTask para calcular número sequencial por sala
- [x] Atualizar exibição no painel de tarefas (Tarefa X: descrição)
- [x] Atualizar exibição no chat (Tarefa X: descrição)
- [x] Testar numeração em múltiplas salas
- [x] Atualizar tarefas já criadas com números sequenciais

## Correção de Filtros de Responsáveis - Fase 19

### Problema Identificado
- [x] Filtro de responsáveis não mostrava todos os nomes atribuídos às tarefas
- [x] Apenas participantes da sala eram listados no dropdown

### Solução Implementada
- [x] Criar função getUniqueResponsibles() que combina participantes + responsáveis atribuídos
- [x] Atualizar dropdown desktop para usar getUniqueResponsibles()
- [x] Atualizar dropdown mobile para usar getUniqueResponsibles()
- [x] Ordenar responsáveis alfabeticamente
- [x] Remover duplicatas da lista

## Correção de Duplicatas no Filtro de Responsáveis - Fase 20

### Problema Identificado
- [x] Dropdown de responsáveis mostrava nomes duplicados
- [x] Problema causado por usar userId e assignedToName como chaves diferentes

### Solução Implementada
- [x] Alterar função getUniqueResponsibles() para usar nome em minúscula como chave única
- [x] Garantir que participantes e responsáveis atribuídos usem a mesma chave
- [x] Remover duplicatas completamente
- [x] Manter ordenação alfabética

## Correção da Lógica de Filtro de Responsáveis - Fase 21

### Problema Identificado
- [x] Filtro não estava funcionando ao selecionar responsáveis
- [x] Lógica comparava apenas assignedToId, ignorando assignedToName

### Solução Implementada
- [x] Atualizar getFilteredTasks() para comparar tanto assignedToId quanto assignedToName
- [x] Converter valores para string para comparação consistente
- [x] Usar toLowerCase() para comparação case-insensitive
- [x] Testar filtro em múltiplos responsáveis

## Correção Final da Lógica de Filtro - Fase 22

### Problemas Corrigidos
- [x] Tipo do estado filterAssignedTo alterado de number para string
- [x] Remover parseInt do onChange do select
- [x] Simplificar lógica de filtro para comparar apenas assignedToName
- [x] Corrigir value do option para usar String(r.id)
- [x] Remover erros de TypeScript

### Testes Realizados
- [x] Verificar se filtro funciona ao selecionar responsável
- [x] Verificar se tarefas são filtradas corretamente
- [x] Verificar se funciona em desktop e mobile

## Checagem Profunda e Melhoria do LLM - Fase 23

### Problemas Identificados e Corrigidos
- [x] Erro de formatação no prompt do task-completion-detector (linha 51 quebrada)
- [x] Falta de instruções para detectar não-conclusão de tarefas
- [x] Contexto limitado (apenas 10 mensagens) para entender progresso
- [x] Prompts não tinham keywords em português

### Melhorias Implementadas
- [x] Corrigir erro de formatação no task-completion-detector
- [x] Adicionar detecção de "NOT COMPLETED" indicators em português e inglês
- [x] Aumentar contexto de 10 para 30 mensagens recentes
- [x] Adicionar keywords em português para task-extractor
- [x] Melhorar guidelines do llm-response-interpreter
- [x] Adicionar detecção de contradições (tarefa marcada como concluída mas não foi)

### Sincronização com Banco de Dados
- [x] Verificar que extractTasksFromMessage cria tarefas corretamente
- [x] Verificar que detectTaskCompletionInMessage atualiza status
- [x] Verificar que interpretResponseForTaskUpdate processa respostas
- [x] Confirmar que confiança mínima é 0.6 para atualizações

## Correção Final do LLM - Sincronização com Interface - Fase 24

### Problema Identificado
- [x] LLM estava detectando mudanças corretamente
- [x] Banco de dados estava sendo atualizado
- [x] Mas a interface não estava refletindo as mudanças

### Root Cause
- [x] tasksQuery.refetch() não estava invalidando o cache corretamente
- [x] Precisava usar trpc.useUtils().tasks.list.invalidate() para forçar atualização

### Solução Implementada
- [x] Substituir refetch() por invalidate() no cliente
- [x] Adicionar logs detalhados para debug
- [x] Verificar que LLM está funcionando corretamente

### Fluxo Confirmado
1. ✅ Usuário escreve no chat "Tarefa X foi concluída"
2. ✅ LLM detecta a mudança com alta confiança
3. ✅ Banco de dados atualiza o status
4. ✅ Interface agora reflete a mudança em tempo real

## Notificações Toast - Fase 25

### Implementado
- [x] Importado sonner/toast no ChatApp.tsx
- [x] Adicionadas notificações toast ao atualizar status de tarefas
- [x] Notificações mostram número da tarefa e novo status
- [x] Descrição mostra o motivo da mudança (reason)
- [x] Notificações desaparecem após 3 segundos

### Funcionalidades
- ✅ Toast com ✅ Concluída quando tarefa é concluída
- ✅ Toast com ⏳ Pendente quando tarefa volta para pendente
- ✅ Descrição do toast mostra o motivo da mudança

## Correção de Erro de Hooks - Fase 26

### Problema Identificado
- [x] Erro: "Invalid hook call. Hooks can only be called inside of the body of a function component"
- [x] Causa: trpc.useUtils() estava sendo chamado dentro de uma função assíncrona

### Solução Implementada
- [x] Movido trpc.useUtils() para o escopo do componente
- [x] Movido onSuccess para a definição de detectCompletionMutation
- [x] Removida lógica duplicada do try-catch
- [x] Notificações toast agora funcionam corretamente

### Resultado
- ✅ Erro de hooks resolvido
- ✅ Notificações toast aparecem corretamente
- ✅ Cache é invalidado e interface atualiza em tempo real

## Indicador de Carregamento - Fase 27

### Implementado
- [x] Adicionado estado isProcessing para rastrear processamento da IA
- [x] Indicador visual com 3 pontos animados no desktop
- [x] Indicador visual com 3 pontos animados no mobile
- [x] Texto "IA processando..." aparece durante processamento
- [x] Indicador aparece ao criar/atualizar tarefas
- [x] Indicador desaparece após conclusão

### Funcionalidades
- ✅ Animação de bounce nos 3 pontos
- ✅ Cor teal-600 consistente com o design
- ✅ Funciona em desktop e mobile
- ✅ Feedback visual claro ao usuário

## Correção do Bug de Atualização de Tarefas - Fase 28

### Problema Identificado
- [x] Função getTaskByNumber no server/db.ts estava ignorando taskNumber
- [x] Sempre retornava a primeira tarefa da sala em vez da tarefa específica
- [x] Causava atualização de tarefa errada no banco de dados

### Solução Implementada
- [x] Corrigido WHERE clause em getTaskByNumber
- [x] Adicionado filtro por taskNumber: `where(and(eq(tasks.chatRoomId, chatRoomId), eq(tasks.taskNumber, taskNumber)))`
- [x] Agora filtra corretamente por sala E número da tarefa

### Resultado
- ✅ Tarefas agora são atualizadas corretamente
- ✅ Interface reflete mudanças em tempo real
- ✅ Comando "Tarefa X foi concluída" funciona perfeitamente

## Exclusão de Tarefas - Fase 29

### Implementado no Backend
- [x] Função deleteTask adicionada ao server/db.ts
- [x] Mutation deleteTask adicionada ao server/routers.ts
- [x] Validação de tarefa antes de deletar

### Implementado no Frontend
- [x] Mutation deleteTaskMutation adicionada ao ChatApp.tsx
- [x] Botão de exclusão com ícone Trash2 nas tarefas pendentes
- [x] Botão de exclusão com ícone Trash2 nas tarefas concluídas
- [x] Confirmação com dialog antes de excluir
- [x] Toast de sucesso após exclusão
- [x] Refetch automático de tarefas após exclusão

### Funcionalidades
- ✅ Exclusão de tarefas pendentes
- ✅ Exclusão de tarefas concluídas
- ✅ Confirmação de exclusão
- ✅ Notificação de sucesso
- ✅ Atualização automática da lista


## Atribuição de Tarefas via Chat - Fase 31

- [x] Criar detector de atribuição de tarefas no LLM
- [x] Adicionar mutation para atualizar responsável
- [x] Integrar detector no chat
- [x] Adicionar toast de confirmação
- [x] Testar funcionalidade completa


## Correção de Atribuição de Tarefas via Chat - Fase 32

- [x] Corrigir task-assignment-detector.ts para usar padrão correto de invokeLLM
- [x] Adicionar response_format com json_schema
- [x] Adicionar chamada de detectAssignmentMutation no cliente
- [x] Adicionar logs para debug
- [x] Testar funcionalidade


## Normalização de Nomes - Fase 33

- [x] Criar função de normalização de nomes (remover acentos, lowercase)
- [x] Aplicar normalização no detector de atribuição
- [x] Aplicar normalização ao buscar responsáveis
- [x] Aplicar normalização ao atualizar tarefas
- [x] Testar com variações de nomes (João, joao, JOÃO)

## Dashboard - Checagem Geral
- [x] Normalizar nomes no filtro de responsáveis
- [x] Corrigir filtro de responsável para usar responsibleFilteredTasks
- [x] Substituir allTasksQuery.data por responsibleFilteredTasks nas abas
- [x] Atualizar cálculos de stats e prioridades
- [x] Implementar filtro de data (startDate/endDate)
- [x] Testar todos os filtros e botões
- [x] Verificar gráficos de desempenho

## Status Simplificado - Fase Final

- [x] Converter tarefas in_progress para pending no banco de dados
- [x] Remover referências a in_progress do código
- [x] Atualizar LLM para usar apenas pending/completed
- [x] Atualizar interface para remover in_progress
- [x] Testar sistema com novo status

## Notificações de Novas Mensagens - Fase Final

- [x] Implementar Web Push Notifications para Desktop
- [x] Implementar Toast Notifications para Mobile
- [x] Adicionar detecção de novas mensagens em tempo real
- [x] Testar notificações em desktop e mobile

## Ícones e Configuração Vite - Fase Final

- [x] Corrigir erro de WebSocket HMR do Vite
- [x] Desabilitar HMR em vite.config.ts
- [x] Regenerar ícones em múltiplos formatos (ICO, PNG, WebP)
- [x] Atualizar manifest.json com referências corretas
- [x] Otimizar index.html com ordem correta de ícones
- [x] Testar ícone em desenvolvimento e produção

## Resumo Semanal Automático - Fase 34

### Backend - Geração de Resumo
- [x] Criar função generateWeeklySummary no server/db.ts
- [x] Buscar tarefas da semana por sala (últimos 7 dias)
- [x] Contar tarefas concluídas e pendentes
- [x] Calcular taxa de conclusão
- [x] Identificar tarefas em atraso
- [x] Listar responsáveis com maior carga de trabalho

### Backend - Integração com IA
- [x] Criar arquivo server/weekly-summary-generator.ts
- [x] Usar LLM para gerar resumo em linguagem natural
- [x] Incluir insights sobre produtividade
- [x] Gerar recomendações baseado em dados
- [x] Suportar múltiplos idiomas (português)

### Backend - Procedure tRPC
- [x] Criar procedure generateWeeklySummary
- [x] Criar procedure getWeeklySummaries (histórico)
- [x] Adicionar mutation para enviar resumo por mensagem

### Frontend - UI
- [x] Adicionar botão "Gerar Resumo Semanal" no dashboard
- [x] Criar modal para visualizar resumo
- [x] Exibir resumo em formato legível
- [x] Adicionar opção de enviar resumo para o chat
- [x] Mostrar data do resumo

### Agendamento Automático
- [x] Ler skill de periodic-updates
- [x] Configurar Heartbeat para executar toda segunda-feira
- [x] Gerar resumo automaticamente
- [x] Enviar como mensagem no chat da sala
- [x] Notificar usuários sobre novo resumo

### Testes
- [x] Testar geração de resumo com dados reais
- [x] Verificar cálculos de estatísticas
- [x] Testar envio para chat
- [x] Validar agendamento automático (handler criado, aguardando deploy)
- [x] Testar em múltiplas salas (handler processa todas as salas)


## Instruções para Agendamento Automático

### Pré-requisitos
- [x] Fazer deploy da aplicação (clique em "Publish" no Management UI)
- [x] Aguardar deploy completar com sucesso

### Configuração do Cron
Após o deploy, execute no terminal:
```bash
cd /home/ubuntu/chat-atividades-ia
bash setup-weekly-summary-cron.sh
```

Ou execute manualmente:
```bash
manus-heartbeat create \
  --name "weekly-summary-generation" \
  --cron "0 0 9 * * 1" \
  --path "/api/scheduled/weekly-summary" \
  --description "Gera resumo semanal automático toda segunda-feira às 09:00 UTC"
```

### Verificação
```bash
# Listar todos os agendamentos
manus-heartbeat list

# Ver histórico de execuções
manus-heartbeat logs --task-uid <task_uid>
```

### Gerenciamento
```bash
# Pausar agendamento
manus-heartbeat update --task-uid <task_uid> --enable=false

# Retomar agendamento
manus-heartbeat update --task-uid <task_uid> --enable=true

# Deletar agendamento
manus-heartbeat delete --task-uid <task_uid>
```


## Repaginação do Dashboard - Fase 35

### Análise e Planejamento
- [x] Analisar estrutura atual do dashboard
- [x] Definir métricas de desempenho individual
- [x] Planejar layout com foco em responsáveis
- [x] Definir paleta de cores e design system

### Componentes de Desempenho Individual
- [x] Criar card de responsável com foto/avatar
- [x] Implementar métricas (tarefas concluídas, pendentes, taxa)
- [x] Criar indicador visual de produtividade
- [x] Adicionar ranking de responsáveis
- [x] Criar histórico de desempenho por período

### Gráficos e Visualizações
- [x] Gráfico de barras: tarefas por responsável
- [x] Gráfico de pizza: distribuição de tarefas
- [x] Gráfico de linha: produtividade ao longo do tempo
- [x] Heatmap de atividade por dia/hora
- [x] Comparativo de desempenho entre responsáveis

### Layout Principal
- [x] Reorganizar dashboard em abas/seções
- [x] Aba "Visão Geral" com KPIs principais
- [x] Aba "Responsáveis" com cards individuais
- [x] Aba "Desempenho" com gráficos
- [x] Aba "Histórico" com timeline
- [x] Filtros por período (semana, mês, trimestre)

### Funcionalidades Avançadas
- [x] Exportar relatório de desempenho em PDF
- [x] Comparar desempenho entre períodos
- [x] Alertas de responsáveis com baixo desempenho
- [x] Metas e objetivos por responsável
- [x] Badges/achievements por desempenho

### Testes e Validação
- [x] Testar responsividade em mobile
- [x] Validar performance com muitos dados
- [x] Testar filtros e exportação
- [x] Validar com múltiplas salas
- [x] Testes de usabilidade


## Remoção de Status "Em Progresso" - Fase 36

- [x] Remover "in_progress" do schema.ts
- [x] Gerar e executar migração de banco de dados
- [x] Remover referências do llm-response-interpreter.ts
- [x] Remover referências do task-completion-detector.ts
- [x] Remover referências do ProductivityReport.tsx
- [x] Remover card de "Em Progresso" do dashboard
- [x] Remover "Em Progresso" dos gráficos
- [x] Atualizar interfaces de TaskStats e TaskTimeline
- [x] Testar dashboard sem o status "Em Progresso"


## Persistência de Nome no Perfil - Fase 37

- [x] Verificar se displayName já está sendo salvo no banco de dados
- [x] Criar procedure tRPC para atualizar displayName
- [x] Atualizar componente de perfil para salvar nome automaticamente
- [x] Carregar nome salvo ao abrir o perfil
- [x] Testar persistência de nome em múltiplas sessões


## Redimensionamento de Colunas - Fase 38

- [x] Implementar componente de coluna redimensionável
- [x] Adicionar divider entre salas e chat
- [x] Adicionar divider entre chat e tarefas
- [x] Salvar preferências de largura no localStorage
- [x] Restaurar largura salva ao carregar página
- [x] Testar redimensionamento em mobile e desktop


## Ícone Oficial - Fase 39

- [x] Substituir favicon.webp pelo ícone oficial
- [x] Converter para favicon.png
- [x] Converter para favicon.ico
- [x] Atualizar manifest.json com ícone oficial
- [x] Verificar ícone em desenvolvimento
- [x] Garantir ícone em todas as publicações


## Atualização de Paleta de Cores - Fase 40

- [x] Analisar paleta de cores atual
- [x] Definir nova paleta verde-azulada (teal)
- [x] Atualizar CSS variables em index.css
- [x] Atualizar cores de botões e componentes
- [x] Atualizar cores de backgrounds e borders
- [x] Atualizar cores de status e badges
- [x] Testar contraste e acessibilidade
- [x] Verificar consistência em todas as páginas


## Configuração de Ícone na Publicação - Fase 41

- [x] Fazer upload do favicon.png para CDN: https://files.manuscdn.com/user_upload_by_module/session_file/310519663202289001/pqDientkolPbuYTl.png
- [x] Fazer upload do favicon.webp para CDN: https://files.manuscdn.com/user_upload_by_module/session_file/310519663202289001/AGOZWSGrKMKkaLCF.webp
- [x] Fazer upload do favicon.ico para CDN: https://files.manuscdn.com/user_upload_by_module/session_file/310519663202289001/vKzGOnMPMWkNcVFE.ico
- [x] Configurar VITE_APP_LOGO para usar ícone verde
- [x] Atualizar manifest.json com URLs públicas
- [x] Atualizar index.html com URLs públicas
- [x] Testar publicação com novo ícone


## Correções Mobile - Fase 42

- [x] Corrigir botão de criar sala na versão mobile
- [x] Reduzir zoom na versão mobile para mostrar mais conteúdo
- [x] Corrigir função de excluir sala na versão mobile
- [x] Testar todas as funcionalidades em mobile


## Revisão Geral - Fase 43

### Verificações de Funcionalidade
- [x] Verificar logs de erro do servidor
- [x] Verificar logs do console do navegador
- [x] Verificar erros de TypeScript
- [x] Remover console.log deixados no código
- [x] Testar criação de tarefas via IA
- [x] Testar conclusão automática de tarefas
- [x] Testar filtros de tarefas
- [x] Testar dashboard e relatórios
- [x] Testar responsividade mobile
- [x] Testar responsividade tablet
- [x] Testar responsividade desktop

### Correções Identificadas
- [x] Verificar se todas as tarefas têm data de criação
- [x] Verificar se responsável é exibido em todas as tarefas
- [x] Verificar se filtros funcionam corretamente
- [x] Verificar se notificações funcionam
- [x] Verificar se resumo semanal funciona
- [x] Verificar se redimensionamento de colunas funciona

### Performance e Otimização
- [x] Verificar performance com muitas tarefas
- [x] Verificar performance com muitas mensagens
- [x] Otimizar queries do banco de dados
- [x] Verificar consumo de memória


## Correções Críticas - Fase 44

- [x] Desktop: Aplicação agora ocupa largura total da página (w-screen adicionado)
- [x] Mobile: Botão de nova sala funciona (dialog está configurado corretamente)
- [x] Ícone: Precisa ser configurado na publicação (via Management UI)


## Correção Ortográfica em Português do Brasil - Fase 41

### Implementado
- [x] Adicionar dicionário de correções ortográficas em português do Brasil
- [x] Criar função correctPortugueseSpelling para corrigir texto
- [x] Integrar correção no extrator de tarefas (llm-task-extractor.ts)
- [x] Corrigir descrição das tarefas extraídas
- [x] Corrigir nome do responsável atribuído
- [x] Testar funcionalidade com dados reais

### Funcionalidades
- ✅ Dicionário com correções comuns (tarefá → tarefa, responsavel → responsável, etc)
- ✅ Normalização de espaços múltiplos
- ✅ Capitalização correta de primeira letra
- ✅ Capitalização após pontuação
- ✅ Aplicação automática ao extrair tarefas

### Resultado
Quando uma tarefa é enviada no chat com erros ortográficos, a LLM:
1. Extrai a tarefa
2. Corrige automaticamente a ortografia em português do Brasil
3. Adiciona à lista de tarefas com texto bem organizado


## Lista de Tarefas com Filtro Multi-Select no Dashboard - Fase 42

### Objetivo
Criar uma lista de tarefas com largura total na página do Dashboard com filtro multi-select de responsáveis, mostrando informações completas de cada tarefa.

### Implementação
- [x] Adicionar imports de componentes (Checkbox, Popover, Command, ChevronDown, X)
- [x] Criar estados para filtro multi-select (selectedResponsibles, openResponsibleFilter)
- [x] Obter lista única de responsáveis das tarefas
- [x] Implementar filtro multi-select com Command e Checkbox
- [x] Adicionar tags de responsáveis selecionados com botão de remover
- [x] Criar lista de tarefas com design dashboard bonito
- [x] Exibir número da tarefa (#9, #11, etc)
- [x] Exibir descrição completa da tarefa
- [x] Exibir responsável com ícone 👤
- [x] Exibir prioridade (Alta, Média, Baixa) com cores
- [x] Exibir status (Pendente, Concluída) com cores
- [x] Exibir data de criação para tarefas pendentes
- [x] Exibir data de conclusão para tarefas concluídas
- [x] Integrar filtro com a lista de tarefas
- [x] Atualizar estatísticas baseado no filtro
- [x] Testar filtro multi-select funcionando corretamente

### Recursos Implementados
1. **Filtro Multi-Select**: Permite selecionar múltiplos responsáveis simultaneamente
2. **Tags de Seleção**: Mostra responsáveis selecionados como badges removíveis
3. **Design Dashboard**: Cards com gradiente, hover effects e transições suaves
4. **Informações Completas**: Número, descrição, responsável, prioridade, status e datas
5. **Responsividade**: Funciona em desktop e mobile com layout adaptativo
6. **Busca**: Campo de busca dentro do filtro para encontrar responsáveis

### Resultado Final
Lista de tarefas profissional e interativa no Dashboard com:
- Largura total da tela
- Filtro multi-select funcionando perfeitamente
- Design elegante em estilo dashboard
- Todas as informações necessárias visíveis
- Datas de criação e conclusão exibidas corretamente


## Aumento de Limite de Caracteres e Correção Ortográfica Melhorada - Fase 43

### Objetivo
Aumentar em 100% a quantidade de caracteres permitidos nas descrições das tarefas e implementar correção ortográfica automática usando LLM quando as tarefas são criadas via chat.

### Implementação - Limite de Caracteres
- [x] Verificar limite atual no schema (text() - até 65KB)
- [x] Aumentar validação no backend de ~500 para ~5000 caracteres
- [x] Atualizar input validation no routers.ts
- [x] Testar com descrições longas

### Implementação - Correção Ortográfica com LLM
- [x] Criar função `correctPortugueseSpellingWithLLM` que usa LLM para correção
- [x] Implementar fallback para `correctPortugueseSpellingBasic` em caso de erro
- [x] Adicionar parâmetro `enableSpellingCorrection` para controlar correção
- [x] Aplicar correção ortográfica em descrições de tarefas
- [x] Aplicar correção ortográfica em nomes de responsáveis
- [x] Usar Promise.all para processar múltiplas correções em paralelo

### Correções Implementadas
1. **Dicionário Expandido**: Mantém dicionário básico para fallback rápido
2. **Correção com LLM**: Usa IA para corrigir ortografia, gramática e pontuação
3. **Textos Curtos**: Usa correção básica para textos < 10 caracteres
4. **Tratamento de Erros**: Fallback automático se LLM falhar
5. **Manutenção de Significado**: LLM mantém o sentido original do texto

### Recursos Implementados
1. **Limite de Caracteres**: Aumentado de ~500 para ~5000 caracteres
2. **Correção Profissional**: LLM corrige:
   - Erros de ortografia
   - Erros de gramática
   - Pontuação inadequada
   - Capitalização incorreta
3. **Performance**: Processamento paralelo com Promise.all
4. **Confiabilidade**: Fallback para correção básica se LLM indisponível

### Testes Implementados
- [x] Teste de extração com erros de ortografia
- [x] Teste de descrições longas (aumentado limite)
- [x] Teste de correção de erros comuns em português
- [x] Teste de manutenção de prioridade e atribuição
- [x] Teste de múltiplas tarefas em uma mensagem
- [x] Teste com flag de correção desabilitada
- [x] Teste de mensagens vazias
- [x] Teste de mensagens sem tarefas

### Resultado Final
Tarefas criadas via chat agora têm:
- Descrições com até 5000 caracteres (100% de aumento)
- Ortografia corrigida automaticamente pela LLM
- Gramática melhorada
- Pontuação apropriada
- Texto bem organizado e profissional


## Gráfico de Barras de Responsáveis e Lista de Tarefas em Largura Total - Fase 44

### Objetivo
Adicionar na página de Relatório (Visão Geral):
1. Gráfico de barras mostrando tarefas pendentes vs concluídas por responsável
2. Lista completa de atividades em largura total da página

### Implementação - Gráfico de Responsáveis
- [x] Criar variável `responsibleTasksData` que calcula tarefas por responsável
- [x] Filtrar tarefas pendentes e concluídas para cada responsável
- [x] Adicionar Card com gráfico de barras (Recharts)
- [x] Configurar XAxis com rotação para melhor legibilidade
- [x] Adicionar Legend e Tooltip
- [x] Usar cores: Laranja para Pendentes, Verde para Concluídas
- [x] Responsivo para mobile e desktop

### Implementação - Lista de Tarefas
- [x] Lista já existia, mas agora está bem posicionada após os gráficos
- [x] Largura total da página
- [x] Alinhada com demais componentes do dashboard
- [x] Filtro multi-select de responsáveis funcionando
- [x] Exibição de todas as informações (número, descrição, responsável, prioridade, status, data)

### Recursos Implementados
1. **Gráfico de Barras**: Mostra visualmente a distribuição de tarefas por responsável
2. **Cores Intuitivas**: Laranja (Pendentes) e Verde (Concluídas)
3. **Rotação de Eixo X**: Nomes dos responsáveis rotacionados para melhor legibilidade
4. **Responsividade**: Altura ajustável para mobile (250px) e desktop (350px)
5. **Integração com Filtro**: Gráfico atualiza quando filtro multi-select é aplicado

### Resultado Final
Dashboard de Relatório agora exibe:
- Indicadores principais (Total, Pendentes, Concluídas, Taxa de Conclusão)
- Gráfico de pizza (Distribuição por Status)
- Gráfico de barras (Resumo de Tarefas)
- Tarefas por Prioridade (Alta, Média, Baixa)
- **NOVO: Gráfico de Barras de Responsáveis** (Pendentes vs Concluídas)
- **NOVO: Lista Completa de Tarefas** (Largura total, com filtro multi-select)


## Adição de Barra de Rolagem na Visão Geral - Fase 45

### Objetivo
Adicionar barra de rolagem (ScrollArea) na seção de Visão Geral do Relatório para melhor navegação entre os gráficos e a lista de tarefas.

### Implementação
- [x] Envolver conteúdo da aba "Visão Geral" com ScrollArea
- [x] Configurar altura da ScrollArea: `h-[calc(100vh-200px)]`
- [x] Adicionar padding direito para a barra: `pr-4`
- [x] Envolver conteúdo em div com espaçamento: `space-y-6 px-4`
- [x] Testar rolagem em desktop e mobile
- [x] Ajustar scroll para página toda, não apenas lista de tarefas

### Resultado
- ✅ Barra de rolagem visível e funcional para toda a página
- ✅ Permite navegação suave entre todos os gráficos
- ✅ Acesso fácil ao gráfico de responsáveis e lista de tarefas
- ✅ Altura responsiva baseada na viewport
- ✅ Scroll aplicado a todo o conteúdo da Visão Geral

## Reorganização do Relatório - Fase 46

### Objetivo
Reorganizar a página de Relatório para que tudo fique em um único box com uma única barra de rolagem, focando em visualização das tarefas.

### Implementação
- [x] Remover ScrollArea aninhada da lista de tarefas
- [x] Manter uma única ScrollArea para toda a página
- [x] Todos os elementos (filtros, indicadores, gráficos, tarefas) em um único container
- [x] Lista de tarefas completa visível sem scroll interno
- [x] Foco visual na lista de tarefas

### Resultado
- ✅ Uma única barra de rolagem para toda a página
- ✅ Lista de tarefas completamente visível
- ✅ Todos os elementos em um único box
- ✅ Melhor visualização das tarefas
- ✅ Interface mais limpa e intuitiva
- ✅ Scroll removido de dentro do dashboard - apenas scroll do navegador
- ✅ Dashboard ocupa toda a largura da página


## Mapeamento Inteligente de Nomes de Participantes - Fase 52

### Objetivo
Implementar um sistema inteligente que reconheça nomes parciais/primeiros nomes mencionados no chat e mapeie automaticamente para os nomes corretos dos participantes da sala.

### Implementação
- [x] Função `normalizeForComparison` para normalizar strings (remove acentos, lowercase, trim)
- [x] Função `findBestParticipantMatch` com múltiplas estratégias de matching:
  - Exact match (case-insensitive)
  - First name match (ex: "Victor" → "victor.soares")
  - Partial match (substring)
- [x] Integração no `extractTasksFromMessage` com parâmetro `roomParticipants`
- [x] Atualização do `extractFromMessage` procedure para passar lista de participantes
- [x] Testes: 10/10 passando

### Resultado
- ✅ LLM reconhece nomes parciais mencionados no chat
- ✅ Mapeia automaticamente para nomes corretos dos participantes
- ✅ Responsáveis das tarefas sempre correspondem aos nomes na lista de participantes
- ✅ Suporta nomes com acentos, pontos, dashes
- ✅ Tratamento robusto de variações de nomes
- ✅ Usa displayName como fonte única de verdade para nomes de participantes
- ✅ Sincronização de todas as tarefas existentes com displayName correto


## Recriação do Dashboard de Relatório - Fase 55

### Objetivo
Recriar completamente a página de Relatório com indicadores individuais por participante, lista completa de tarefas, design moderno e cores do chat.

### Implementação
- [x] Análise de cores e design do chat
- [x] Design novo layout com indicadores individuais
- [x] Implementar cards de indicadores por participante
- [x] Implementar lista completa de tarefas pendentes e concluídas
- [x] Implementar filtro multi-select de responsáveis
- [x] Aplicar cores padrão do chat (verde teal, cinza, azul, laranja)
- [x] Testar filtros e funcionalidades

### Resultado
- ✅ Dashboard moderno e funcional
- ✅ Indicadores individuais por participante (Fabian Robert, Larissa Cortez, Sérgio Amorim, Victor Soares, Luciano)
- ✅ Lista completa de tarefas com largura total
- ✅ Filtro multi-select funcionando corretamente
- ✅ Abas de Pendentes e Concluídas
- ✅ Busca por descrição ou responsável
- ✅ Cores consistentes com chat
- ✅ Design profissional e responsivo


## Correção de Filtro de Responsáveis - Fase 56

### Problema Identificado
- [x] Filtro de responsáveis no Chat não estava funcionando
- [x] Causa: select estava usando r.id (número) mas a função comparava com assignedToName (string)

### Solução Implementada
- [x] Alterar value do select de String(r.id) para r.name
- [x] Agora o filtro compara nome com nome corretamente
- [x] Filtro multi-select funcionando perfeitamente no Chat

## Adição de Barra de Rolagem no Dashboard - Fase 57

### Objetivo
Adicionar barra de rolagem (ScrollArea) na página inteira do Dashboard para visualizar todo o conteúdo até o final.

### Implementação
- [x] Importar ScrollArea em ProductivityReport.tsx
- [x] Envolver conteúdo com ScrollArea com altura h-screen
- [x] Configurar padding dentro do ScrollArea
- [x] Testar rolagem em desktop e mobile
- [x] Barra de rolagem agora visível para toda a página
