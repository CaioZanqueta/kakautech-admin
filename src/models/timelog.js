import Sequelize, { Model } from "sequelize";

class TimeLog extends Model {
  static init(sequelize) {
    super.init(
      {
        seconds_spent: Sequelize.INTEGER,
        ticketId: {
          type: Sequelize.INTEGER,
          field: "ticket_id",
        },
        userId: {
          type: Sequelize.INTEGER,
          field: "user_id",
        },
      },
      {
        sequelize,
        tableName: "time_logs", // Nome explícito da tabela
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Ticket, { foreignKey: "ticketId" });
    this.belongsTo(models.User, { foreignKey: "userId" });
  }
}

export default TimeLog;