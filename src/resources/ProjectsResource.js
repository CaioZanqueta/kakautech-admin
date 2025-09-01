import AdminJS from "adminjs";
import Project from "../models/project";
import { hasManagerPermission } from "../services/auth";

export default {
  resource: Project,
  options: {
    parent: {
      icon: "Roadmap",
    },
    actions: {
      new: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      edit: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
      delete: {
        isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin),
      },
    },
    properties: {
      id: {
        position: 1,
      },
      name: {
        position: 2,
        isRequired: true,
      },
      description: {
        position: 3,
        type: "textarea",
      },
      support_hours_limit: {
        position: 4,
        label: "Limite de Horas de Suporte",
      },
      userId: {
        position: 5,
      },
      user_id: {
        isVisible: false,
      },
      status: {
        position: 6,
        isRequired: true,
        availableValues: [
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ],
      },
      createdAt: {
        position: 7,
        isVisible: { list: true, filter: true, show: true, edit: false },
      },
      updatedAt: {
        position: 8,
        isVisible: { list: true, filter: true, show: true, edit: false },
      },
      // ===== CAMPO VIRTUAL PARA MOSTRAR O BOTÃO DE RELATÓRIOS =====
      relatorios: {
        // Este campo "falso" só existe para mostrar o nosso botão
        components: {
          // Renderiza o nosso componente na página de "show" (detalhes)
          show: AdminJS.bundle('../components/GoToReportsButton.jsx'),
        },
        // Removemos o rótulo para que só o botão apareça
        label: ' ',
      },
      // ================================================================
    },
  },
};