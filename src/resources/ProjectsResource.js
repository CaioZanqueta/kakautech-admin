import AdminJS from "adminjs"; // 1. IMPORTAMOS O ADMINJS
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
      // ===== 2. ADICIONAMOS A NOVA AÇÃO DE RELATÓRIOS =====
      reports: {
        actionType: "record", // É uma ação para um registo específico (um projeto)
        icon: "ReportAnalytics",
        label: "Relatórios",
        handler: async (request, response, context) => {
          // A lógica para buscar os dados virá aqui no futuro
          return {
            record: context.record.toJSON(context.currentAdmin),
          };
        },
        // Usamos o nosso novo componente React para renderizar a página
        component: AdminJS.bundle("../components/ProjectReports.jsx"),
      },
      // =======================================================
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
    },
  },
};
