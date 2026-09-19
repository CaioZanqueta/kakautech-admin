const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

const migration = source(
  "src/database/migrations/20260919000100-project-task-work-management.js"
);
assert.match(migration, /async up/);
assert.match(migration, /async down/);
assert.match(migration, /client_id/);
assert.match(migration, /task_assignees/);
assert.match(migration, /task_comments/);
assert.match(migration, /task_attachments/);
assert.match(migration, /work_logs/);

assert.match(source("src/models/client.js"), /hasMany\(m\.Project/);
assert.match(source("src/models/project.js"), /hasMany\(m\.Task/);
assert.match(source("src/models/task.js"), /belongsToMany\(m\.User/);
assert.match(source("src/routes/task-management.routes.js"), /duration_minutes/);
assert.match(source("src/routes/task-management.routes.js"), /position/);
assert.match(source("src/services/worklog-report.js"), /csvSafe/);

const server = source("src/server.js");
assert.match(server, /scriptSrcAttr:\s*\["'unsafe-inline'"\]/);

const dashboard = source("src/views/admin/admin-dashboard.ejs");
assert.match(dashboard, /response\.ok/);
assert.match(dashboard, /renderStatusFallback/);

console.log("project-hours tests: ok");
