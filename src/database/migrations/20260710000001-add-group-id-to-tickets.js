'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'group_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'groups', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tickets', 'group_id');
  },
};
