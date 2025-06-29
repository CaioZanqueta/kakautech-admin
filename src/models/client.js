// src/models/client.js
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
        // Novos campos
        google_id: Sequelize.STRING,
        microsoft_id: Sequelize.STRING,
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
    this.hasMany(models.Ticket);
  }

  checkPassword(password) {
    // Adiciona uma verificação para garantir que o hash exista
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

export default Client;