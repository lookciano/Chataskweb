# Fase 6 — Operação, backup e recuperação

## Escopo

Este runbook orienta backup, restauração, monitoramento e rollback do Chataskweb.
A aplicação usa usuários, salas, membros, mensagens, tarefas, tarefas pessoais,
convites, reações e estados de leitura. Nenhuma operação de recuperação deve
ser feita diretamente no banco de produção sem aprovação explícita.

## Backup do TiDB

No TiDB Cloud, confirmar:

- backup automático ativado;
- retenção e frequência configuradas;
- alerta de falha habilitado;
- ponto de restauração disponível;
- usuário do runtime separado do usuário de migração;
- conexão TLS obrigatória;
- backup inclui todas as tabelas do aplicativo.

Nunca armazenar `DATABASE_URL`, senhas ou tokens neste repositório.

## Teste de restauração

1. Escolher um backup sem alterar o banco de produção.
2. Restaurar em um cluster/banco separado.
3. Configurar uma cópia temporária do aplicativo para o ambiente restaurado.
4. Conferir usuários, salas, memberships, administradores, mensagens, tarefas,
   tarefas pessoais, convites, reações e estados de leitura.
5. Testar login, acesso por sala e privacidade das tarefas pessoais.
6. Registrar data, backup usado, resultado e discrepâncias.
7. Descartar o ambiente temporário somente após a conferência.

## Privilégios do banco

A conta usada pelo serviço deve ter somente os privilégios necessários ao
runtime. A conta de migração deve ser separada. Revisar periodicamente e evitar
`DROP`, `CREATE USER` e `GRANT OPTION` na conta de runtime.

## Health check

Endpoint público e sem autenticação:

```text
GET /api/health
```

Resposta esperada:

```json
{"ok":true}
```

O endpoint não deve retornar configuração, status do banco, secrets, versões ou
stack trace. O Render está configurado para usar `/api/health`.

## Monitoramento

Acompanhar no Render:

- serviço `Live`;
- reinicializações;
- respostas 5xx;
- tempo de resposta;
- falhas de conexão com TiDB;
- falhas da LLM;
- falhas de storage;
- falhas de push;
- erros de autenticação;
- uso de memória e CPU.

Configurar um monitor externo para consultar `/api/health` em intervalo regular.
O monitor deve alertar quando houver timeout ou resposta diferente de 200.

## Rollback do aplicativo

1. Identificar o commit/deploy que causou o problema.
2. Usar o rollback do Render para o último deploy funcional.
3. Não restaurar o banco automaticamente.
4. Confirmar compatibilidade do código anterior com o schema atual.
5. Testar `/api/health`, login, salas, mensagens e tarefas.
6. Registrar o incidente e o commit restaurado.

Rollback de código e restauração de banco são operações independentes.

## Teste de recuperação

Usar uma sala de teste, nunca salas protegidas. Confirmar que:

- usuário existente entra;
- sala antiga aparece para membro aprovado;
- não membro não vê a sala;
- mensagem é preservada;
- tarefa é preservada;
- tarefa pessoal continua privada;
- administrador de sala mantém a permissão correta;
- usuário externo não consegue excluir a sala.

## Eventos que podem ser auditados

Registrar sem conteúdo sensível:

- login e falha de login;
- entrada por convite;
- promoção/revogação de administrador;
- remoção de membro;
- exclusão de sala, mensagem ou tarefa;
- alteração de responsável/status.

Não registrar senhas, JWTs, API keys, tokens FCM, mensagens completas,
descrições completas ou stack traces em respostas públicas.

## Checklist periódico

### Diário

- [ ] `/api/health` responde 200
- [ ] Render está `Live`
- [ ] Não há aumento anormal de 5xx

### Semanal

- [ ] Logs revisados sem dados sensíveis
- [ ] Backups disponíveis
- [ ] Erros do TiDB, LLM e storage revisados

### Mensal

- [ ] Restauração de teste realizada ou agendada
- [ ] Privilégios do TiDB revisados
- [ ] Administradores globais e de sala revisados
- [ ] Secrets revisados no Render
- [ ] Procedimento de rollback revisado

## Proibições

Não executar diretamente em produção durante uma recuperação:

- `DROP`;
- `TRUNCATE`;
- exclusão em massa;
- recriação de usuários;
- recriação de salas;
- restauração sobre o banco atual sem aprovação;
- migração não planejada.
