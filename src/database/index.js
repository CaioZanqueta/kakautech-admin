import Sequelize from "sequelize";
import config from "../config/database.js";

import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import Client from "../models/client.js";
import Ticket from "../models/ticket.js";
import Comment from "../models/comment.js";
import TimeLog from "../models/timelog.js";
import ActivityLog from "../models/activitylog.js";

const models = [User, Project, Task, Client, Ticket, Comment, TimeLog, ActivityLog];

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
