'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('clients', 'avatar_path', {
      type: Sequelize.STRING,
      allowNull: true, // Permitimos que seja nulo, pois nem todos os clientes terão uma foto
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('clients', 'avatar_path');
  }
};