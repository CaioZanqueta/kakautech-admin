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

    // ===================================================================
    // ===== INÍCIO DA MODIFICAÇÃO: Lógica de Tempo Refatorada =====
    // ===================================================================
    this.addHook("beforeUpdate", async (ticket, options) => {
      // Verificamos se o campo 'status' foi o que mudou
      if (ticket.changed("status")) {
        const statusAnterior = ticket.previous("status");
        const statusNovo = ticket.get("status");

        // LÓGICA PARA PARAR O CRONÓMETRO E REGISTAR O TEMPO
        if (statusAnterior === "in_progress" && ticket.in_progress_started_at) {
          const timeNow = new Date();
          const startTime = new Date(ticket.in_progress_started_at);
          const durationInSeconds = Math.round((timeNow - startTime) / 1000);

          // 1. Cria um novo registo detalhado na tabela time_logs
          // Usamos this.sequelize.models para evitar problemas de importação circular
          await ticket.sequelize.models.TimeLog.create({
            seconds_spent: durationInSeconds,
            ticketId: ticket.id,
            userId: ticket.userId, // Assume que o responsável pelo chamado é quem registou o tempo
          });

          // 2. Para manter a compatibilidade, ainda atualizamos o contador total no chamado.
          // Isto evita quebrar outras partes do sistema que possam usar este campo.
          ticket.time_spent_seconds =
            (ticket.time_spent_seconds || 0) + durationInSeconds;

          // Limpamos o timestamp de início para a próxima vez
          ticket.in_progress_started_at = null;
        }

        // LÓGICA PARA INICIAR O CRONÓMETRO (permanece igual)
        if (statusNovo === "in_progress") {
          ticket.in_progress_started_at = new Date();
        }
      }
    });
    // ===================================================================
    // ===== FIM DA MODIFICAÇÃO =====
    // ===================================================================

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Client, { foreignKey: "clientId", as: "Client" });
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: "ticket_id" });
    this.hasMany(models.TimeLog, { foreignKey: "ticketId" });
    this.hasMany(models.ActivityLog, { foreignKey: "ticketId" });
  }
}

export default Ticket;
