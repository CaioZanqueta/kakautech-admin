import Sequelize, { Model } from "sequelize";

class Group extends Model {
  static init(sequelize) {
    super.init(
      {
        name:        Sequelize.STRING,
        slug:        Sequelize.STRING,
        description: Sequelize.TEXT,
        status:      Sequelize.ENUM("active", "archived"),
      },
      {
        sequelize,
        tableName: "groups",
        name: { singular: "group", plural: "groups" },
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsToMany(models.User, {
      through: "user_groups",
      foreignKey: "group_id",
      otherKey: "user_id",
      as: "Users",
    });
    this.belongsToMany(models.Project, {
      through: "project_groups",
      foreignKey: "group_id",
      otherKey: "project_id",
      as: "Projects",
    });
  }
}

export default Group;
