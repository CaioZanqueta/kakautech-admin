import AdminJS from "adminjs";
import uploadFeature from "@adminjs/upload";
import Task from "../models/task";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials";

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

// ===== FUNÇÃO AUXILIAR PARA ABREVIAR NOMES =====
const getShortName = (fullName) => {
  if (!fullName) return '';
  const names = fullName.split(' ').filter(Boolean);
  if (names.length > 1) {
    return `${names[0]} ${names[names.length - 1]}`;
  }
  return fullName;
};
// ===============================================

export default {
  resource: Task,
  options: {
    parent: {
      icon: "Task",
    },
    actions: {
      // ===== MODIFICAÇÃO: Hook para abreviar nomes na listagem =====
      list: {
        after: async (response) => {
          response.records.forEach((record) => {
            if (record.populated.userId) {
              const fullName = record.populated.userId.title;
              record.populated.userId.title = getShortName(fullName);
            }
          });
          return response;
        },
      },
      // =============================================================
      show: {
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
    },
    properties: {
      id: { position: 1 },
      title: { position: 2, isRequired: true },
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
      due_date: { position: 4 },
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
      userId: { position: 8, isRequired: true },
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
        isVisible: { list: false, show: true, edit: true },
        components: {
          show: AdminJS.bundle("../components/AttachmentComponent.jsx"),
        },
      },
      user_id: { isVisible: false },
      project_id: { isVisible: false },
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