import Sequelize, { Model } from "sequelize";

class Ticket extends Model {
  static init(sequelize) {
    super.init(
      {
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        status: Sequelize.ENUM("open", "in_progress", "closed"),
        projectId: {
          type: Sequelize.INTEGER,
          field: 'project_id',
          references: { model: 'projects', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        clientId: {
          type: Sequelize.INTEGER,
          field: 'client_id'
        },
        userId: {
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
    return this; // <<-- ADICIONADO
  }

  static associate(models) {
    this.belongsTo(models.Client, { foreignKey: "clientId" });
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: 'ticket_id' }); // <<-- ADICIONADO
  }
}

export default Ticket;