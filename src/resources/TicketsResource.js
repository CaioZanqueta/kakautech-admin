import AdminJS from "adminjs";

import Ticket from "../models/ticket";

import uploadFeature from "@adminjs/upload";

import credentials from "../config/credentials.js";

import { hasManagerPermission } from "../services/auth";

export default {
  resource: Ticket,

  options: {
    parent: {
      icon: "Ticket",
    }, // A seção 'actions' agora SÓ tem o necessário

    actions: {
      show: {
        component: AdminJS.bundle("../components/TicketShow.jsx"),
      },

      edit: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      }, // A AÇÃO 'assignToMe' FOI COMPLETAMENTE REMOVIDA DAQUI
    },

    properties: {
      id: { position: 1 },

      title: { position: 2, isRequired: true, isTitle: true },

      description: { position: 3, type: "textarea" },

      status: {
        position: 4,

        isRequired: true,

        availableValues: [
          { value: "open", label: "Aberto" },

          { value: "pending", label: "Pendente" },

          { value: "in_progress", label: "Em Andamento" },

          { value: "closed", label: "Fechado" },
        ],
      },

      clientId: { position: 5, label: "Cliente" },

      projectId: { position: 6, label: "Projeto" },

      userId: { position: 7, label: "Responsável" },

      attachment: { position: 8 },

      time_spent_seconds: {
        isVisible: false,
      },
      in_progress_started_at: { isVisible: false },
      createdAt: { isVisible: { list: true, show: false, edit: false } },

      updatedAt: { isVisible: { list: false, show: false, edit: false } },

      client_id: { isVisible: false },

      user_id: { isVisible: false },

      project_id: { isVisible: false },

      path: { isVisible: false },

      folder: { isVisible: false },

      type: { isVisible: false },

      filename: { isVisible: false },

      size: { isVisible: false },
    },
  },

  features: [
    uploadFeature({
      provider: { aws: credentials },

      properties: {
        key: "path",
        bucket: "folder",
        mimeType: "type",

        size: "size",
        filename: "filename",
        file: "attachment",
      },

      validation: {
        mimeTypes: [
          "image/png",
          "image/gif",
          "image/jpeg",
          "application/pdf",
          "application/zip",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],

        maxSize: 5 * 1024 * 1024,
      },
    }),
  ],
};
