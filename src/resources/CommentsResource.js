// src/resources/CommentsResource.js (ATUALIZADO)

import Comment from "../models/comment";
import { hasManagerPermission } from "../services/auth";

export default {
  resource: Comment,
  options: {
    // ADICIONADO: Esta linha remove o recurso do menu da barra lateral
    navigation: null,

    parent: {
      icon: "Message2",
    },
    actions: {
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
      content: {
        isTitle: true,
        type: "textarea",
      },
      ticket_id: {
        label: "ID do Chamado",
      },
      user_id: {
        label: "Autor (Equipe)",
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