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
        
        // <<-- CORREÇÃO: Definição explícita do campo projectId -->>
        projectId: {
          type: Sequelize.INTEGER,
          field: 'project_id', // Mapeia este campo para a coluna 'project_id' no DB
          references: {
            model: 'projects',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },

        status: {
          type: Sequelize.ENUM('pending', 'active', 'inactive'),
          defaultValue: 'pending',
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
    this.hasMany(models.Ticket, { foreignKey: 'clientId' }); // Adicionado para clareza
    // A chave estrangeira é `projectId` no modelo Client
    this.belongsTo(models.Project, { foreignKey: 'projectId' });
  }

  checkPassword(password) {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

export default Client;