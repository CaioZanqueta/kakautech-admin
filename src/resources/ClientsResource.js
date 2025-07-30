import Client from "../models/client";
import { hasAdminPermission } from "../services/auth";
import MailService from '../services/mail';
import ejs from 'ejs'; // <<-- ADICIONADO
import path from 'path'; // <<-- ADICIONADO
import { fileURLToPath } from 'url'; // <<-- ADICIONADO para __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      
      edit: {
        isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin),
        after: async (response, request, context) => {
          const { record } = context;
          const originalRecordStatus = context.record.previous('status');
          const newStatus = record.get('status');

          if (originalRecordStatus === 'pending' && newStatus === 'active') {
            try {
              // <<-- MUDANÇA: Renderiza o template EJS -->>
              const emailHtml = await ejs.renderFile(
                path.join(__dirname, '../views/emails/clientApproved.ejs'),
                { name: record.get('name') } // Passa os dados para o template
              );

              await MailService.sendMail(
                record.get('email'), 
                'Sua conta foi aprovada!',
                emailHtml
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
      projectId: { position: 4, isRequired: true },
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
      project_id: { isVisible: false },
    },
  },
};