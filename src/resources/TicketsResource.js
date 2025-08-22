import AdminJS from "adminjs";
import Ticket from "../models/ticket";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials.js";
import { hasManagerPermission } from "../services/auth";
import uploadFeature from "@adminjs/upload";

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

export default {
  resource: Ticket,
  options: {
    parent: {
      icon: "Ticket",
    },
    actions: {
      show: {
        component: AdminJS.bundle("../components/TicketShow.jsx"),
        // === INÍCIO DA CORREÇÃO ===
        after: async (response) => {
          // Vamos modificar diretamente o 'record' da resposta
          const record = response.record;
          if (record && record.params.path) {
            const command = new GetObjectCommand({
              Bucket: record.params.folder,
              Key: record.params.path,
            });
            const signedUrl = await getSignedUrl(s3, command, {
              expiresIn: 3600,
            });
            // Adicionamos a nova propriedade diretamente aos params da resposta
            response.record.params.signedUrl = signedUrl;
          }
          return response;
        },
        // === FIM DA CORREÇÃO ===
      },
      edit: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
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
      attachment: { isVisible: false },
      time_spent_seconds: { isVisible: false },
      in_progress_started_at: { isVisible: false },
      createdAt: { isVisible: { list: true, show: false, edit: false } },
      updatedAt: { isVisible: { list: false, show: false, edit: false } },
      client_id: { isVisible: false },
      user_id: { isVisible: false },
      project_id: { isVisible: false },
      path: {
        isVisible: { list: false, edit: false, filter: false, show: true },
      },
      folder: {
        isVisible: { list: false, edit: false, filter: false, show: true },
      },
      type: {
        isVisible: { list: false, edit: false, filter: false, show: true },
      },
      filename: {
        isVisible: { list: false, edit: false, filter: false, show: true },
      },
      size: {
        isVisible: { list: false, edit: false, filter: false, show: true },
      },
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
