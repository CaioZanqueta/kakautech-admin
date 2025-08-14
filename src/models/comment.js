import Sequelize, { Model } from "sequelize";

class Comment extends Model {
  static init(sequelize) {
    super.init(
      {
        content: Sequelize.TEXT,
        ticket_id: Sequelize.INTEGER,
        user_id: Sequelize.INTEGER,
        client_id: Sequelize.INTEGER,
      },
      {
        sequelize,
        name: {
          singular: "comment",
          plural: "comments",
        },
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
    this.belongsTo(models.User, { foreignKey: 'user_id' });
    this.belongsTo(models.Client, { foreignKey: 'client_id' });
  }
}

export default Comment;