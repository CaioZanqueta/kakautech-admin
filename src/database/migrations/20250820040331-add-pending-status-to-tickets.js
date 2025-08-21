'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Comando SQL específico do PostgreSQL para adicionar um novo valor a um ENUM existente
    await queryInterface.sequelize.query("ALTER TYPE enum_tickets_status ADD VALUE 'pending';");
  },

  down: async (queryInterface, Sequelize) => {
    // Reverter esta ação é complexo e destrutivo,
    // então optamos por não fazer nada no 'down' para segurança.
  }
};