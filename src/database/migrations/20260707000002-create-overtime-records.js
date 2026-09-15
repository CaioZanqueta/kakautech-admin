'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('overtime_records', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tickets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'projects', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Data/hora reais de início e fim do atendimento
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      // Apenas as horas que de fato são HE (excedente fora do comercial)
      overtime_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // "ticket" = gerado ao fechar chamado | "manual" = adicionado avulso
      source: {
        type: Sequelize.ENUM('ticket', 'manual'),
        allowNull: false,
        defaultValue: 'manual',
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

    await queryInterface.addIndex('overtime_records', ['user_id']);
    await queryInterface.addIndex('overtime_records', ['ticket_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('overtime_records');

    // Remover enum criado pelo Sequelize
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_overtime_records_source";'
    );
  },
};
