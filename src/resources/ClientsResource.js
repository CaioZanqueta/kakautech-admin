import Client from "../models/client.js";
import { hasAdminPermission } from "../services/auth.js";
import MailService from "../services/mail.js";
import ejs from "ejs";
import path from "path";

export default {
  resource: Client,
  options: {
    parent: {
      icon: "User",
    },
    actions: {
      list: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
      },
      show: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
      },
      new: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
      },

      edit: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
        before: async (request, context) => {
          if (context.record && context.record.isValid()) {
            context.originalStatus = context.record.get("status");
          }
          return request;
        },
        after: async (response, request, context) => {
          const { record } = context;
          const originalStatus = context.originalStatus;
          const newStatus = record.get("status");

          if (originalStatus === "pending" && newStatus === "active") {
            try {
              const emailHtml = await ejs.renderFile(
                path.join(__dirname, "../views/emails/clientApproved.ejs"),
                { name: record.get("name") }
              );

              await MailService.sendMail(
                record.get("email"),
                "Sua conta foi aprovada!",
                emailHtml
              );
            } catch (error) {
              console.error("Falha ao enviar email de aprovação:", error);
            }
          }
          return response;
        },
      },
      delete: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
      },
    },
    properties: {
      id: { position: 1 },
      name: { isRequired: true, position: 2 },
      email: { isRequired: true, position: 3 },
      projectId: {
        position: 4,
        isRequired: true,
      },
      status: {
        position: 5,
        isRequired: true,
        availableValues: [
          { value: "pending", label: "Pendente" },
          { value: "active", label: "Ativo" },
          { value: "inactive", label: "Inativo" },
        ],
      },
      password: {
        isVisible: { list: false, filter: false, show: false, edit: true },
        position: 6,
      },
      createdAt: { isVisible: false },
      updatedAt: { isVisible: false },
      microsoft_id: { isVisible: false },
      google_id: { isVisible: false },
      password_hash: { isVisible: false },
      project_id: {
        isVisible: false,
      },
      // Adicionado para garantir que não apareça na UI
      shortName: { isVisible: false },
    },
  },
};