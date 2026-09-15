import Sequelize, { Model } from "sequelize";

class Holiday extends Model {
  static init(sequelize) {
    super.init(
      {
        date: Sequelize.DATEONLY,
        name: Sequelize.STRING,
        year: Sequelize.INTEGER,
      },
      {
        sequelize,
        tableName: "holidays",
      }
    );
    return this;
  }
}

export default Holiday;
