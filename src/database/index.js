import Sequelize from "sequelize";
import config from "../config/database";

import User from "../models/user";
import Project from "../models/project";
import Task from "../models/task";
import Client from "../models/client";
import Ticket from "../models/ticket";
import Comment from "../models/comment";
import TimeLog from "../models/timelog";

const models = [User, Project, Task, Client, Ticket, Comment, TimeLog];

class Database {
  constructor() {
    this.connection = new Sequelize(config);
    this.init();
    this.associate();
  }

  init() {
    models.forEach((model) => model.init(this.connection));
  }

  associate() {
    models.forEach((model) => {
      if (model.associate) {
        model.associate(this.connection.models);
      }
    });
  }
}

export default new Database();
