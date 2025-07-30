'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('clients', 'google_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('clients', 'microsoft_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    // Tornar o password_hash opcional
    await queryInterface.changeColumn('clients', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('clients', 'google_id');
    await queryInterface.removeColumn('clients', 'microsoft_id');
    await queryInterface.changeColumn('clients', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: false, // Reverte para o estado anterior
    });
  }
};