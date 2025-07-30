import Client from "../models/client";
import { hasAdminPermission } from "../services/auth";

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
      edit: { isAccessible: ({ currentAdmin }) => hasAdminPermission(currentAdmin) },
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
      
      // <<-- ADICIONADO: Esconde a coluna duplicada -->>
      project_id: {
        isVisible: false,
      },
    },
  },
};