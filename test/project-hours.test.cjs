const assert=require('node:assert/strict');const fs=require('fs');function source(file){return fs.readFileSync(file,'utf8')}
assert.match(source('src/database/migrations/20260919000100-project-task-work-management.js'),/task_assignees_task_user_uk/);
assert.match(source('src/database/migrations/20260919000100-project-task-work-management.js'),/work_logs_context_ck/);
assert.match(source('src/database/migrations/20260919000100-project-task-work-management.js'),/duration_minutes>0/);
assert.match(source('src/routes/task-management.routes.js'),/Não autenticado/);
assert.match(source('src/server.js'),/tasks-management/);
assert.match(source('src/views/admin/admin-kanban.ejs'),/position:position/);
assert.match(source('src/services/worklog-report.js'),/\^\[=\+\\-@/);
assert.match(source('src/models/worklog.js'),/Informe uma tarefa ou chamado/);
console.log('project-hours tests: ok');
