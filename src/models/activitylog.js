import Sequelize, { Model } from "sequelize";

class ActivityLog extends Model {
  static init(sequelize) {
    super.init(
      {
        description: Sequelize.TEXT,
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
        tableName: "activity_logs",
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Ticket, { foreignKey: "ticketId" });
    this.belongsTo(models.User, { foreignKey: "userId" });
  }
}

export default ActivityLog;