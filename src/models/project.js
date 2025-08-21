// src/models/project.js

import Sequelize, { Model } from "sequelize";

class Project extends Model {
  static init(sequelize) {
    super.init(
      {
        name: Sequelize.STRING,
        description: Sequelize.TEXT,
        status: Sequelize.ENUM("active", "archived"),
        support_hours_limit: Sequelize.FLOAT, // ADICIONADO AQUI
        user_id: Sequelize.INTEGER,
      },
      {
        sequelize,
        name: {
          singular: "project",
          plural: "projects",
        },
      }
    );
    return this; // Retorno adicionado para consistência
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: "user_id",
    });
    this.hasMany(models.Task);
    this.hasMany(models.Client, { foreignKey: "project_id" });
  }
}

export default Project;