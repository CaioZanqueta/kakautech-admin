import Sequelize, { Model } from "sequelize";

class Project extends Model {
  static init(sequelize) {
    super.init(
      {
        name:        Sequelize.STRING,
        description: Sequelize.TEXT,
        status:      Sequelize.ENUM("active", "archived"),
        support_hours_limit: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        user_id: Sequelize.INTEGER,
      },
      {
        sequelize,
        name: { singular: "project", plural: "projects" },
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: "user_id", as: "User" });
    this.hasMany(models.Task);
    this.hasMany(models.Client, { foreignKey: "project_id" });

    // ── GRUPOS ──────────────────────────────────────────────────
    this.belongsToMany(models.Group, {
      through: "project_groups",
      foreignKey: "project_id",
      otherKey: "group_id",
      as: "Groups",
    });
  }
}

export default Project;
