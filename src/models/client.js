import Sequelize, { Model } from "sequelize";
import bcrypt from "bcryptjs";

class Client extends Model {
  static init(sequelize) {
    super.init(
      {
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
    this.hasMany(models.Ticket, { foreignKey: "clientId" });
    this.belongsTo(models.Project, { foreignKey: "projectId" });
    this.hasMany(models.Comment, { foreignKey: "client_id" }); // <<-- ADICIONADO
  }

  checkPassword(password) {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

export default Client;
