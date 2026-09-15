'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('on_call_schedules');
    if (!tableDesc.nivel) {
      await queryInterface.addColumn('on_call_schedules', 'nivel', {
        type: Sequelize.INTEGER,
        allowNull: true, // null = não definido (registros antigos)
        defaultValue: null,
        comment: '1 = Primeiro Nível, 2 = Segundo Nível, 3 = Terceiro Nível',
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('on_call_schedules', 'nivel');
  },
};
