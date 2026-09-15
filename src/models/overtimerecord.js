import Sequelize, { Model } from "sequelize";

class OvertimeRecord extends Model {
  static init(sequelize) {
    super.init(
      {
        userId: {
          type: Sequelize.INTEGER,
          field: "user_id",
        },
        ticketId: {
          type: Sequelize.INTEGER,
          field: "ticket_id",
        },
        projectId: {
          type: Sequelize.INTEGER,
          field: "project_id",
        },
        started_at: Sequelize.DATE,
        ended_at: Sequelize.DATE,
        overtime_minutes: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        description: Sequelize.TEXT,
        source: {
          type: Sequelize.ENUM("ticket", "manual"),
          defaultValue: "manual",
        },
      },
      {
        sequelize,
        tableName: "overtime_records",
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: "userId", as: "User" });
    this.belongsTo(models.Ticket, { foreignKey: "ticketId", as: "Ticket" });
    this.belongsTo(models.Project, { foreignKey: "projectId", as: "Project" });
  }
}

export default OvertimeRecord;
