import AdminJS from "adminjs";
import Ticket from "../models/ticket";
import User from "../models/user";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials.js";
import { hasManagerPermission } from "../services/auth";
import uploadFeature from "@adminjs/upload";
import Client from "../models/client.js";
import MailService from "../services/mail.js";
import ejs from "ejs";
import path from "path";

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

const statusTranslations = {
  open: "Aberto",
  pending: "Pendente",
  in_progress: "Em Andamento",
  closed: "Fechado",
};

const getShortName = (fullName) => {
  if (!fullName) return '';
  const names = fullName.split(' ').filter(Boolean);
  if (names.length > 1) {
    return `${names[0]} ${names[names.length - 1]}`;
  }
  return fullName;
};

export default {
  resource: Ticket,
  options: {
    parent: {
      icon: "Ticket",
    },
    sort: {
      direction: "desc",
      sortBy: "createdAt",
    },
    actions: {
      list: {
        after: async (response) => {
          response.records.forEach((record) => {
            if (record.populated.clientId) {
              const fullName = record.populated.clientId.title;
              record.populated.clientId.title = getShortName(fullName);
            }
            if (record.populated.userId) {
              const fullName = record.populated.userId.title;
              record.populated.userId.title = getShortName(fullName);
            }
          });
          return response;
        },
      },
      show: {
        component: AdminJS.bundle("../components/TicketShow.jsx"),
        after: async (response) => {
          const record = response.record;
          if (record && record.params.path) {
            const command = new GetObjectCommand({
              Bucket: record.params.folder,
              Key: record.params.path,
            });
            const signedUrl = await getSignedUrl(s3, command, {
              expiresIn: 3600,
            });
            response.record.params.signedUrl = signedUrl;
          }
          return response;
        },
      },
      edit: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
        before: async (request, context) => {
          const { record } = context;
          if (record && record.isValid()) {
            context.originalTicket = await Ticket.findByPk(record.id());
          }
          return request;
        },
        after: async (response, request, context) => {
          const { record, originalTicket, currentAdmin } = context;
          // ===== MODIFICAÇÃO: Forma mais segura de aceder ao modelo =====
          const ActivityLog = Ticket.sequelize.models.ActivityLog;
          // =============================================================

          // LÓGICA DE LOG DE ATIVIDADE
          if (originalTicket && ActivityLog) {
            const newStatus = record.get('status');
            const oldStatus = originalTicket.status;

            if (newStatus !== oldStatus) {
              await ActivityLog.create({
                description: `Status alterado de "${statusTranslations[oldStatus] || oldStatus}" para "${statusTranslations[newStatus] || newStatus}"`,
                ticketId: record.id(),
                userId: currentAdmin.id,
              });
            }

            const newUserId = record.get('userId');
            const oldUserId = originalTicket.userId;

            if (newUserId != oldUserId) {
              const oldUser = oldUserId ? await User.findByPk(oldUserId) : null;
              const newUser = newUserId ? await User.findByPk(newUserId) : null;
              const oldUserName = oldUser ? oldUser.name : 'Ninguém';
              const newUserName = newUser ? newUser.name : 'Ninguém';

              await ActivityLog.create({
                description: `Responsável alterado de "${oldUserName}" para "${newUserName}"`,
                ticketId: record.id(),
                userId: currentAdmin.id,
              });
            }
          }

          // LÓGICA DE NOTIFICAÇÃO POR EMAIL
          const newStatusEmail = record.get("status");
          if (originalTicket && newStatusEmail !== originalTicket.status) {
            if (originalTicket.status === "open" && newStatusEmail === "pending") {
              return response;
            }
            try {
              const client = await Client.findByPk(originalTicket.clientId);
              if (client) {
                const emailHtml = await ejs.renderFile(
                  path.join(
                    __dirname,
                    "../views/emails/ticketStatusChanged.ejs"
                  ),
                  {
                    clientName: client.name,
                    ticketId: record.id(),
                    ticketTitle: record.get("title"),
                    oldStatus:
                      statusTranslations[originalTicket.status] ||
                      originalTicket.status,
                    newStatus: statusTranslations[newStatusEmail] || newStatusEmail,
                    ticketUrl: `${
                      process.env.BASE_URL || "http://localhost:5000"
                    }/portal/tickets/${record.id()}`,
                  }
                );
                await MailService.sendMail(
                  client.email,
                  `O seu Chamado ${record.get("title")} foi atualizado`,
                  emailHtml
                );
              }
            } catch (mailError) {
              console.error(
                "Falha ao enviar email de mudança de status:",
                mailError
              );
            }
          }
          return response;
        },
      },
    },
    properties: {
      id: {
        isVisible: { list: false, filter: true, show: true, edit: false },
      },
      title: { position: 2, isRequired: true, isTitle: true },
      description: {
        position: 3,
        type: "textarea",
        isVisible: { list: false, filter: false, show: true, edit: true },
      },
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
      priority: {
        position: 5,
        isRequired: true,
        availableValues: [
          { value: "low", label: "Baixa" },
          { value: "medium", label: "Média" },
          { value: "high", label: "Alta" },
        ],
      },
      clientId: { position: 6, label: "Cliente" },
      projectId: { position: 7, label: "Projeto" },
      userId: { position: 8, label: "Responsável" },
      attachment: { isVisible: false },
      time_spent_seconds: { isVisible: false },
      in_progress_started_at: { isVisible: false },
      createdAt: { isVisible: { list: true, show: true, edit: false } },
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