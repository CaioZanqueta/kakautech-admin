import Comment from "../models/comment";
import { hasManagerPermission } from "../services/auth";

export default {
  resource: Comment,
  options: {
    parent: {
      icon: "Message2",
    },
    actions: {
      // Apenas admins/managers podem apagar comentários
      delete: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      bulkDelete: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      // Ninguém deve poder criar/editar comentários diretamente por aqui
      new: { isVisible: false },
      edit: { isVisible: false },
    },
    properties: {
      content: {
        isTitle: true, // Torna o conteúdo o item principal na lista
        type: "textarea",
      },
      ticket_id: {
        // Renomeia o campo na interface
        label: "ID do Chamado",
      },
      user_id: {
        label: "Autor (Equipa)",
      },
      client_id: {
        label: "Autor (Cliente)",
      },
      createdAt: {
        isVisible: { list: true, show: true, edit: false, filter: true },
      },
    },
  },
};
