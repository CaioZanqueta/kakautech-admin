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
        // CAMPOS ADICIONADOS
        project_id: Sequelize.INTEGER,
        status: Sequelize.ENUM('pending', 'active', 'inactive'),
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
    // ASSOCIAÇÃO ADICIONADA
    this.belongsTo(models.Project, { foreignKey: 'project_id' });
  }

  checkPassword(password) {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

export default Client;