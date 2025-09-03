import ActivityLog from "../models/activitylog.js";
import { hasManagerPermission } from "../services/auth.js";

export default {
  resource: ActivityLog,
  options: {
    // navigation: null torna o recurso invisível no menu lateral
    navigation: null,
    actions: {
      // Permitimos apenas as ações de ver e apagar os logs
      list: { isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin) },
      show: { isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin) },
      delete: { isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin) },
      bulkDelete: { isAccessible: ({ currentAdmin }) => hasManagerPermission(currentAdmin) },
      new: { isVisible: false },
      edit: { isVisible: false },
    },
    properties: {
      id: { position: 1 },
      description: { isTitle: true, position: 2 },
      ticketId: { position: 3 },
      userId: { position: 4, label: 'Realizado Por' },
      createdAt: { position: 5, label: 'Data' },
    },
  },
};