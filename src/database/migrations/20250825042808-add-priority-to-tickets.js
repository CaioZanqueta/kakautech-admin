'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'priority', {
      type: Sequelize.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tickets', 'priority');
    // Se precisar reverter, terá de apagar o ENUM manualmente na base de dados
    // await queryInterface.sequelize.query('DROP TYPE "enum_tickets_priority";');
  }
};