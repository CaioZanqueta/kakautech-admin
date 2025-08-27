import Sequelize, { Model } from "sequelize";
import bcrypt from "bcryptjs";

class Client extends Model {
  static init(sequelize) {
    super.init(
      {
        // ===== CAMPO VIRTUAL ADICIONADO =====
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
        // ===================================
        name: Sequelize.STRING,
        email: Sequelize.STRING,
        password: Sequelize.VIRTUAL,
        password_hash: Sequelize.STRING,
        google_id: Sequelize.STRING,
        microsoft_id: Sequelize.STRING,
        projectId: {
          type: Sequelize.INTEGER,
          field: "project_id",
          references: { model: "projects", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        status: {
          type: Sequelize.ENUM("pending", "active", "inactive"),
          defaultValue: "pending",
        },
      },
      {
        sequelize,
        name: {
          singular: "client",
          plural: "clients",
        },
      }
    );

    this.addHook("beforeSave", async (client) => {
      if (client.password) {
        client.password_hash = await bcrypt.hash(client.password, 8);
      }
    });

    return this;
  }

  static associate(models) {
    this.hasMany(models.Ticket, { foreignKey: "clientId", as: 'Tickets' });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: "client_id" });
  }

  checkPassword(password) {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

export default Client;