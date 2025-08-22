'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adiciona as mesmas colunas de anexo que já temos nos tickets
    await queryInterface.addColumn('comments', 'path', { type: Sequelize.STRING });
    await queryInterface.addColumn('comments', 'folder', { type: Sequelize.STRING });
    await queryInterface.addColumn('comments', 'type', { type: Sequelize.STRING });
    await queryInterface.addColumn('comments', 'filename', { type: Sequelize.STRING });
    await queryInterface.addColumn('comments', 'size', { type: Sequelize.INTEGER });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('comments', 'path');
    await queryInterface.removeColumn('comments', 'folder');
    await queryInterface.removeColumn('comments', 'type');
    await queryInterface.removeColumn('comments', 'filename');
    await queryInterface.removeColumn('comments', 'size');
  }
};