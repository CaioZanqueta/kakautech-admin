import Sequelize, { Model } from "sequelize";

class OnCallSchedule extends Model {
  static init(sequelize) {
    super.init(
      {
        groupId:       { type: Sequelize.INTEGER, allowNull: false },
        userId:        { type: Sequelize.INTEGER, allowNull: false },
        nivel:         { type: Sequelize.INTEGER, allowNull: true }, // 1, 2, 3
        startsAt:      { type: Sequelize.DATE,    allowNull: false },
        endsAt:        { type: Sequelize.DATE,    allowNull: true },
        endedAt:       { type: Sequelize.DATE,    allowNull: true },
        phoneOverride: { type: Sequelize.STRING,  allowNull: true },
        notes:         { type: Sequelize.TEXT,    allowNull: true },

        isActive: {
          type: Sequelize.VIRTUAL,
          get() {
            if (this.endedAt) return false;
            const now = new Date();
            if (now < new Date(this.startsAt)) return false;
            if (this.endsAt && now > new Date(this.endsAt)) return false;
            return true;
          },
        },

        // Label legível do nível
        nivelLabel: {
          type: Sequelize.VIRTUAL,
          get() {
            const map = { 1: '1º Nível', 2: '2º Nível', 3: '3º Nível' };
            return map[this.nivel] || null;
          },
        },
      },
      {
        sequelize,
        modelName: "OnCallSchedule",
        tableName: "on_call_schedules",
        underscored: true,
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Group, { foreignKey: "groupId", as: "Group" });
    this.belongsTo(models.User,  { foreignKey: "userId",  as: "User"  });
  }
}

export default OnCallSchedule;
