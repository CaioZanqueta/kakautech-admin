import Sequelize, { Model } from "sequelize";

class Ticket extends Model {
  static init(sequelize) {
    super.init(
      {
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        status: Sequelize.ENUM("open", "pending", "in_progress", "closed"),
        priority: {
          type: Sequelize.ENUM("low", "medium", "high"),
          defaultValue: "medium",
        },
        time_spent_seconds: Sequelize.INTEGER,
        in_progress_started_at: Sequelize.DATE,
        projectId: {
          type: Sequelize.INTEGER,
          field: "project_id",
          references: { model: "projects", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        clientId: {
          type: Sequelize.INTEGER,
          field: "client_id",
        },
        userId: {
          type: Sequelize.INTEGER,
          field: "user_id",
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

    this.addHook("beforeUpdate", (ticket) => {
      if (ticket.changed('status')) {
        const statusAnterior = ticket.previous('status');
        const statusNovo = ticket.get('status');
        if (statusAnterior === 'in_progress' && ticket.in_progress_started_at) {
          const timeNow = new Date();
          const startTime = new Date(ticket.in_progress_started_at);
          const durationInSeconds = Math.round((timeNow - startTime) / 1000);
          ticket.time_spent_seconds = (ticket.time_spent_seconds || 0) + durationInSeconds;
          ticket.in_progress_started_at = null;
        }
        if (statusNovo === 'in_progress') {
          ticket.in_progress_started_at = new Date();
        }
      }
    });

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Client, { foreignKey: "clientId", as: 'Client' });
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: "ticket_id" });
  }
}

export default Ticket;