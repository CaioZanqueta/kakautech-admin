import AdminJS from 'adminjs';
import Ticket from '../models/ticket';
import uploadFeature from '@adminjs/upload';
import credentials from '../config/credentials.js';

export default {
  resource: Ticket,
  options: {
    parent: {
      icon: 'Ticket',
    },
    properties: {
      id: { position: 1 },
      title: { position: 2, isRequired: true },
      description: {
        position: 3,
        type: 'textarea',
        isVisible: { list: false, show: true, edit: true },
      },
      status: {
        position: 4,
        isRequired: true,
        availableValues: [
          { value: 'open', label: 'Aberto' },
          { value: 'in_progress', label: 'Em Andamento' },
          { value: 'closed', label: 'Fechado' },
        ],
      },
      clientId: {
        position: 5,
        label: 'Cliente'
      },
      attachment: {
        position: 6,
      },
      createdAt: {
        position: 7,
        isVisible: { list: true, show: true, edit: false },
      },
      updatedAt: {
        position: 8,
        isVisible: { list: false, show: true, edit: false },
      },
      client_id: { isVisible: false },
      userId: { isVisible: false },
      user_id: { isVisible: false },
      path: { isVisible: false },
      folder: { isVisible: false },
      type: { isVisible: false },
      filename: { isVisible: false },
      size: { isVisible: false },
    },
  },
  features: [
    uploadFeature({
      provider: { aws: credentials },
      properties: {
        key: 'path',
        bucket: 'folder',
        mimeType: 'type',
        size: 'size',
        filename: 'filename',
        file: 'attachment',
      },
      validation: {
        mimeTypes: ["image/png", "image/gif", "image/jpeg", "application/pdf", "application/zip", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        maxSize: 5 * 1024 * 1024,
      },
    }),
  ],
};