import Client from "../models/client";
import { hasAdminPermission } from "../services/auth";

export default {
  resource: Client,
  options: {
    parent: {
      icon: "User",
    },
    actions: {
      // É uma boa prática restringir o acesso aos dados dos clientes
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
      password: { isVisible: { list: false, filter: false, show: false, edit: true }, position: 4 },
      password_hash: { isVisible: false },
    },
  },
};