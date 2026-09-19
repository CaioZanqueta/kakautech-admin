# Gestão hierárquica de projetos e horas

## Arquitetura

O fluxo principal passa a ser `Cliente -> Projetos -> Tarefas/Chamados -> WorkLogs`. A coluna legada `clients.project_id`, `time_logs` e os contadores dos chamados foram preservados para compatibilidade durante a transição.

## Banco de dados

As migrations criam `projects.client_id`, ampliam `tasks`, criam `task_assignees`, `task_comments`, `task_attachments`, `work_logs` e generalizam `activity_logs`. A primeira migration tenta copiar o projeto legado dos clientes e mantém registros sem correspondência como nulos, sem excluir dados.

Executar:

```bash
npm ci
npm run db:migrate
npm run build
npm test
```

Reverter uma etapa por vez:

```bash
npm run db:undo
```

Antes do rollback, exporte os registros criados nas novas tabelas. O `down` remove apenas estruturas adicionadas por sua respectiva migration; ele não remove a coluna legada.

## Uso administrativo

- Kanban: `/admin/resources/tasks`
- Relatório consolidado: `/admin/reports/worklogs`
- Comentários, responsáveis, anexos e apontamentos usam `/admin/api/tasks-management/:taskId/...`
- CSV e Excel são gerados em streaming e não ficam armazenados em `public`.
- Downloads de anexos usam URL S3 assinada por cinco minutos.

## Apontamentos

Apontamentos manuais armazenam duração inteira em minutos. Ao encerrar um cronômetro de chamado, o registro legado em `time_logs` é mantido e um `work_logs` é criado para consolidação, quando chamado, projeto e responsável estão definidos.

## Limitações conhecidas

- A validação automatizada desta branch é estrutural e não substitui testes de integração com PostgreSQL, S3 e OAuth.
- PDF consolidado não foi habilitado nesta etapa; CSV e XLSX são exportados por streaming.
- O vínculo `clients.project_id` permanece depreciado para compatibilidade e só deve ser removido em migration futura após auditoria dos dados.
- O relatório limita a consulta a 5.000 apontamentos por requisição; use períodos menores em bases grandes.

## Homologação

- [ ] Criar cliente e dois projetos para o mesmo cliente.
- [ ] Criar tarefa com história, critérios, prazo e estimativa.
- [ ] Adicionar vários responsáveis.
- [ ] Mover a tarefa no Kanban e recarregar a página.
- [ ] Criar comentário autenticado e validar bloqueio sem sessão.
- [ ] Enviar anexo válido e bloquear tipo/tamanho inválido.
- [ ] Validar que usuário sem acesso ao projeto não baixa o anexo.
- [ ] Registrar horas manuais com duração positiva.
- [ ] Iniciar e encerrar chamado, confirmando TimeLog e WorkLog.
- [ ] Filtrar relatório por cliente, projeto, recurso, período e origem.
- [ ] Exportar CSV e XLSX e validar neutralização de fórmulas.
- [ ] Validar isolamento entre clientes no portal.
- [ ] Executar migrations em banco vazio e cópia do esquema anterior.
- [ ] Executar quatro rollbacks em ambiente descartável.

## Plano de rollback

1. Suspender gravações de tarefas e horas.
2. Exportar `work_logs`, comentários, anexos e responsáveis criados após a implantação.
3. Executar `npm run db:undo` para cada migration, da mais recente à mais antiga.
4. Restaurar a versão anterior da aplicação.
5. Confirmar funcionamento do portal, chamados e `time_logs` legados.
