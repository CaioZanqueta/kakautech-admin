import Sequelize, { Model } from "sequelize";
import { createPasswordHash, checkPassword } from "../services/auth";

class User extends Model {
  static init(sequelize) {
    super.init(
      {
        initials: {
          type: Sequelize.VIRTUAL,
          get() {
            const match = this.name.split(" ");
            if (match.length > 1) {
              return `${match[0][0]}${match[match.length - 1][0]}`;
            } else if (match.length === 1 && match[0] !== '') {
              return match[0][0];
            }
            return '';
          },
        },
        shortName: {
          type: Sequelize.VIRTUAL,
          get() {
            const fullName = this.name || '';
            const names = fullName.split(' ').filter(Boolean);
            if (names.length > 1) {
              return `${names[0]} ${names[names.length - 1]}`;
            }
            return fullName;
          },
        },
        name:           Sequelize.STRING,
        email:          Sequelize.STRING,
        phone:          Sequelize.STRING,  // ← campo adicionado para plantão
        password:       Sequelize.VIRTUAL,
        password_hash:  Sequelize.STRING,
        google_id:      Sequelize.STRING,
        microsoft_id:   Sequelize.STRING,
        role:           Sequelize.ENUM("admin", "manager", "developer"),
        status:         Sequelize.ENUM("active", "archived"),
      },
      {
        sequelize,
        name: {
          singular: "user",
          plural: "users",
        },
      }
    );

    this.addHook("beforeSave", async (user) => {
      if (user.password) {
        user.password_hash = await createPasswordHash(user.password);
      }
    });

    return this;
  }

  static associate(models) {
    this.hasMany(models.Project);
    this.hasMany(models.Task);
    this.hasMany(models.Ticket, { foreignKey: "userId" });
    this.hasMany(models.Comment, { foreignKey: "user_id" });
    this.hasMany(models.TimeLog, { foreignKey: "userId" });
    this.hasMany(models.ActivityLog, { foreignKey: "userId" });
    if (models.Group) {
      this.belongsToMany(models.Group, {
        through: "user_groups",
        as: "Groups",
        foreignKey: "user_id",
        otherKey: "group_id",
      });
    }
    if (models.OnCallSchedule) {
      this.hasMany(models.OnCallSchedule, { foreignKey: "userId", as: "OnCallSchedules" });
    }
  }

  checkPassword(password) {
    if (!this.password_hash) return false;
    return checkPassword(this, password);
  }
}

export default User;
