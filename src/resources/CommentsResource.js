import Comment from "../models/comment.js";
import { hasManagerPermission } from "../services/auth.js";
// NOVAS IMPORTAÇÕES
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials.js";

// NOVA INSTÂNCIA DO S3
const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

export default {
  resource: Comment,
  options: {
    navigation: null,
    parent: {
      icon: "Message2",
    },
    actions: {
      // NOVO: HOOK PARA GERAR URL NA AÇÃO DE LISTAGEM
      list: {
        after: async (response, request, context) => {
          const { records } = context;
          for (const record of records) {
            if (record.params.path) {
              const command = new GetObjectCommand({
                Bucket: record.params.folder,
                Key: record.params.path,
              });
              const signedUrl = await getSignedUrl(s3, command, {
                expiresIn: 3600,
              });
              record.params.signedUrl = signedUrl;
            }
          }
          return response;
        },
      },
      delete: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      bulkDelete: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      new: { isVisible: false },
      edit: { isVisible: false },
    },
    properties: {
      content: { isTitle: true, type: "textarea" },
      ticket_id: { label: "ID do Chamado" },
      user_id: { label: "Autor (Equipe)" },
      client_id: { label: "Autor (Cliente)" },
      createdAt: {
        isVisible: { list: true, show: true, edit: false, filter: true },
      },
    },
  },
};
