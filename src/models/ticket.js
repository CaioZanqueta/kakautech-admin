import Sequelize, { Model } from "sequelize";

class Ticket extends Model {
  static init(sequelize) {
    super.init(
      {
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        status: Sequelize.ENUM(
          "open",
          "in_progress",
          "closed"
        ),
        
        // <<-- CORREÇÃO: Definição explícita do campo projectId -->>
        projectId: {
          type: Sequelize.INTEGER,
          field: 'project_id',
          references: {
            model: 'projects',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        
        clientId: { // Adicionado para consistência
          type: Sequelize.INTEGER,
          field: 'client_id'
        },
        
        userId: { // Adicionado para consistência
          type: Sequelize.INTEGER,
          field: 'user_id'
        },

        path: Sequelize.STRING,
        folder: Sequelize.STRING,
        type: Sequelize.STRING,
        filename: Sequelize.STRING,
        size: Sequelize.INTEGER,
      },
      {
        sequelize,
        name: {
          singular: "ticket",
          plural: "tickets",
        },
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.Client, {
      foreignKey: "clientId",
    });
    this.belongsTo(models.User, {
      foreignKey: "userId",
    });
    this.belongsTo(models.Project, {
      foreignKey: "projectId",
    });
  }
}

export default Ticket;