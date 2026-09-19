# Gestão hierárquica de projetos, tarefas e horas

## Arquitetura
A hierarquia canônica passa a ser Cliente → Projetos → Tarefas/Chamados. `projects.client_id` é a nova relação; `clients.project_id`, anexos únicos de tarefas e `time_logs` permanecem temporariamente para compatibilidade.

Novas tabelas: `task_assignees`, `task_comments`, `task_attachments` e `work_logs`. Tarefas recebem história de usuário, critérios de aceite, início, estimativa em minutos, prioridade, posição, criador e conclusão.

## Migração
1. Faça backup do PostgreSQL.
2. Execute `npm ci`, `npm run build` e `npm run db:migrate`.
3. A migration adiciona `projects.client_id` nullable e migra somente relações legadas sem ambiguidade.
4. Registros antigos de `time_logs` são copiados para `work_logs`; a tabela original não é removida.
5. Consulte projetos sem cliente e clientes com relações ambíguas antes de tornar a FK obrigatória em uma versão futura.

## Rollback
Execute `npm run db:undo`. O rollback remove somente as novas tabelas e colunas. Como as estruturas legadas são preservadas, chamados, clientes e registros antigos continuam disponíveis. Faça backup antes do rollback porque comentários, anexos e horas criados exclusivamente nas novas tabelas serão removidos.

## Operação
- Kanban: `/admin/resources/tasks`.
- Relatório consolidado: `/admin/reports/worklogs`.
- Comentários, anexos e apontamentos usam `/admin/api/tasks-management/:taskId/...` com autenticação e autorização por projeto.
- Downloads usam URL S3 assinada de curta duração; credenciais vêm somente do ambiente.

## Testes
Execute `npm test`, `npm run build`, `npm run db:migrate` e `npm run db:undo`. Em banco representativo, valide primeiro uma cópia do esquema anterior. O ambiente automatizado sem PostgreSQL permite somente validação estática; migrations e rollback precisam de homologação real.

## Homologação
- [ ] Criar cliente e dois projetos.
- [ ] Criar tarefa com história, critérios, prazo e estimativa.
- [ ] Adicionar vários responsáveis.
- [ ] Mover a tarefa e atualizar a página para confirmar status e posição.
- [ ] Criar comentário autenticado e negar requisição anônima.
- [ ] Enviar vários anexos e negar download fora do projeto autorizado.
- [ ] Registrar horas manuais com duração positiva.
- [ ] Iniciar e encerrar chamado; conferir `time_logs` e `work_logs`.
- [ ] Filtrar relatório por cliente, projeto, recurso, período e origem.
- [ ] Exportar CSV e Excel e validar neutralização de fórmulas.
- [ ] Validar isolamento entre clientes no portal.
- [ ] Executar rollback em banco de teste.

## Limitações conhecidas
O PDF consolidado e a exposição de tarefas no portal não foram habilitados para evitar ampliar acesso do cliente a dados internos. A remoção das colunas legadas exige auditoria dos dados após período de transição.
