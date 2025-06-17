import * as path from "path";

import AdminJS from "adminjs";

import uploadFeature from "@adminjs/upload";

import Task from "../models/task";

import credentials from "../config/credentials";

export default {
  resource: Task,
  options: {
    parent: {
      icon: "Task",
    },
    properties: {
      id: {
        position: 1,
      },
      title: {
        position: 2,
        isRequired: true,
      },
      description: {
        position: 3,
        isVisible: { list: false, filter: false, show: true, edit: true },
        type: "textarea",
        props: {
          quill: {
            modules: {
              toolbar: [
                ["bold", "italic"],
                ["link", "image"],
              ],
            },
          },
        },
      },
      due_date: {
        position: 4,
      },
      order: {
        position: 5,
        isRequired: true,
        availableValues: [
          { value: "Low", label: "Baixa" },
          { value: "Medium", label: "Média" },
          { value: "High", label: "Alta" },
        ],
      },
      status: {
        position: 6,
        isRequired: true,
        availableValues: [
          { value: "backlog", label: "Backlog" },
          { value: "doing", label: "Em Execução" },
          { value: "done", label: "Pronto" },
          { value: "approved", label: "Aprovado" },
          { value: "rejected", label: "Rejeitado" },
        ],
      },
      projectId: {
        position: 7,
        isRequired: true,
        isVisible: { list: false, filter: true, show: true, edit: true },
      },
      userId: {
        position: 8,
        isRequired: true,
      },
      createdAt: {
        position: 9,
        isVisible: { list: true, filter: true, show: true, edit: false },
      },
      updatedAt: {
        position: 10,
        isVisible: { list: false, filter: true, show: true, edit: false },
      },
      attachment: {
        position: 11,
      },
      user_id: {
        isVisible: false,
      },
      project_id: {
        isVisible: false,
      },
      path: {
        isVisible: false,
      },
      folder: {
        isVisible: false,
      },
      type: {
        isVisible: false,
      },
      filename: {
        isVisible: false,
      },
      size: {
        isVisible: false,
      },
    },
  },
  features: [
    uploadFeature({
      provider: {
        // aws: credentials,
        local: {
          bucket: path.join(__dirname, "../../uploads"),
        },
      },
      properties: {
        key: "path",
        bucket: "folder",
        mimeType: "type",
        size: "size",
        filename: "filename",
        file: "attachment",
      },
      validation: {
        mimeTypes: ["image/png", "image/gif", "image/jpeg", "image/vnd.adobe.photoshop", "application/pdf", "application/zip", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        maxSize: 5 * 1024 * 1024,
      },
    }),
  ],
};
