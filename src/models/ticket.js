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
      foreignKey: "client_id",
    });

    this.belongsTo(models.User, {
      foreignKey: "user_id",
    });
  }
}

export default Ticket;