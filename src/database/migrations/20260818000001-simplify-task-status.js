"use strict";

// Simplifica o fluxo de status das tarefas: remove "approved" e "rejected"
// (o quadro de aprovação não tinha nenhuma regra de permissão real por trás,
// então qualquer pessoa podia "aprovar" a própria tarefa arrastando o card).
// Fica só: backlog -> doing -> done.
//
// Dados existentes são migrados antes de encolher o ENUM:
//   approved -> done   (já estava pronto e tecnicamente aceito)
//   rejected -> doing  (volta para retrabalho)

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE tasks SET status = 'done' WHERE status = 'approved'`
    );
    await queryInterface.sequelize.query(
      `UPDATE tasks SET status = 'doing' WHERE status = 'rejected'`
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status TYPE TEXT`
    );
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_tasks_status"`);
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_tasks_status" AS ENUM('backlog', 'doing', 'done')`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status TYPE "enum_tasks_status" USING status::"enum_tasks_status"`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog'`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status TYPE TEXT`
    );
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_tasks_status"`);
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_tasks_status" AS ENUM('backlog', 'doing', 'done', 'approved', 'rejected')`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status TYPE "enum_tasks_status" USING status::"enum_tasks_status"`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog'`
    );
  },
};
