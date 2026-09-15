'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabela de plantões
    await queryInterface.createTable('on_call_schedules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      starts_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true, // null = plantão em aberto (sem previsão de fim)
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true, // preenchido quando o admin encerra manualmente
      },
      phone_override: {
        type: Sequelize.STRING,
        allowNull: true, // número alternativo para este plantão (sobrescreve o do perfil)
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Campo phone no model de usuários (se não existir)
    const tableDesc = await queryInterface.describeTable('users');
    if (!tableDesc.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('on_call_schedules');
    await queryInterface.removeColumn('users', 'phone');
  },
};
