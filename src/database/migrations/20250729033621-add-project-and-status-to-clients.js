"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("clients", "status", {
      type: Sequelize.ENUM("pending", "active", "inactive"),
      defaultValue: "pending",
      allowNull: false,
    });
    await queryInterface.addColumn("clients", "project_id", {
      type: Sequelize.INTEGER,
      references: { model: "projects", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true, 
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("clients", "status");
    await queryInterface.removeColumn("clients", "project_id");
  },
};
