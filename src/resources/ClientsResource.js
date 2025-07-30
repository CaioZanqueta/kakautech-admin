import Client from "../models/client";
import { hasAdminPermission } from "../services/auth";
import MailService from '../services/mail';

export default {
  resource: Client,
  options: {
    parent: {
      icon: "User",
    },
    actions: {
      list: { isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin) },
      show: { isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin) },
      new: { isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin) },

      // <<-- MUDANÇA: Lógica de verificação de status corrigida -->>
      edit: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),

        // Passo 1: Antes de salvar, guardamos o status original
        before: async (request, context) => {
          if (context.record && context.record.isValid()) {
            // Guardamos o status original no contexto para usá-lo depois
            context.originalStatus = context.record.get('status');
          }
          return request;
        },

        // Passo 2: Depois de salvar, comparamos o status original com o novo
        after: async (response, request, context) => {
          const { record } = context;
          const originalStatus = context.originalStatus;
          const newStatus = record.get('status');

          if (originalStatus === 'pending' && newStatus === 'active') {
            try {
              await MailService.sendMail(
                record.get('email'), 
                'Sua conta foi aprovada!',
                `<p>Olá, ${record.get('name')}!</p><p>Sua conta no portal Kakau Tech foi aprovada. Já pode fazer o login e abrir os seus chamados.</p>`
              );
            } catch (error) {
                console.error("Falha ao enviar email de aprovação:", error);
            }
          }
          return response;
        }
      },

      delete: { isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin) },
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
          { value: 'pending', label: 'Pendente' },
          { value: 'active', label: 'Ativo' },
          { value: 'inactive', label: 'Inativo' },
        ],
      },
      password: { isVisible: { list: false, filter: false, show: false, edit: true }, position: 6 },
      password_hash: { isVisible: false },
      project_id: {
        isVisible: false,
      },
    },
  },
};