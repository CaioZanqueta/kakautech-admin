import Sequelize, { Model } from "sequelize";

class Ticket extends Model {
  static init(sequelize) {
    super.init(
      {
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        status: Sequelize.ENUM("open", "pending", "in_progress", "closed"),
        time_spent_seconds: Sequelize.INTEGER,
        // NOSSO NOVO CAMPO DE CONTROLO
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

    // ===================================================================
    // LÓGICA FINAL DO CRONÓMETRO (HOOK)
    // ===================================================================
    this.addHook("beforeUpdate", (ticket) => {
      // Verificamos apenas se o campo 'status' foi o que mudou
      if (ticket.changed('status')) {
        const statusAnterior = ticket.previous('status');
        const statusNovo = ticket.get('status');

        // LÓGICA PARA PARAR O CRONÓMETRO
        if (statusAnterior === 'in_progress' && ticket.in_progress_started_at) {
          const timeNow = new Date();
          const startTime = new Date(ticket.in_progress_started_at);
          const durationInSeconds = Math.round((timeNow - startTime) / 1000);
          
          ticket.time_spent_seconds = (ticket.time_spent_seconds || 0) + durationInSeconds;
          // Limpamos o timestamp de início para a próxima vez
          ticket.in_progress_started_at = null;
        }

        // LÓGICA PARA INICIAR O CRONÓMETRO
        if (statusNovo === 'in_progress') {
          // Guardamos o momento exato em que o status mudou para 'in_progress'
          ticket.in_progress_started_at = new Date();
        }
      }
    });

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Client, { foreignKey: "clientId" });
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: "ticket_id" });
  }
}

export default Ticket;