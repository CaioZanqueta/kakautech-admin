'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'in_progress_started_at', {
      type: Sequelize.DATE, // Usamos DATE que guarda a data e hora completas
      allowNull: true,     // Será nulo quando não estiver em andamento
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tickets', 'in_progress_started_at');
  }
};