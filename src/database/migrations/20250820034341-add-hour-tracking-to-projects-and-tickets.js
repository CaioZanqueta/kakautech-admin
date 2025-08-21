'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adiciona o limite de horas na tabela de PROJETOS
    await queryInterface.addColumn('projects', 'support_hours_limit', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    // Adiciona o contador de tempo na tabela de CHAMADOS
    await queryInterface.addColumn('tickets', 'time_spent_seconds', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('projects', 'support_hours_limit');
    await queryInterface.removeColumn('tickets', 'time_spent_seconds');
  }
};